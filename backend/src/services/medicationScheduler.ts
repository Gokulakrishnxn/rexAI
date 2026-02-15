import { supabase } from '../utils/supabase.js';
import { sendMedicationEmail } from './resendService.js';

let schedulerTimeout: NodeJS.Timeout | null = null;
let isPolling = false;

/**
 * Get the nearest future scheduled time from all active schedules
 */
const getNextScheduledTime = async (): Promise<Date | null> => {
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata' // Matching the check logic
    });

    // We need to find the next time *today* that hasn't passed, OR the earliest time *tomorrow*
    // For simplicity in this SQL-json structure, we'll iterate active schedules.
    // A more robust way would be a Postgres function, but JS logic is fine for now.

    const { data: schedules, error } = await supabase
        .from('medication_schedules')
        .select('exact_times')
        .eq('active', true);

    if (error || !schedules) return null;

    let nearestTime: Date | null = null;
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    for (const sched of schedules) {
        if (!sched.exact_times || !Array.isArray(sched.exact_times)) continue;

        for (const timeStr of sched.exact_times) {
            // Parse time string (e.g. "9:00 AM")
            // specific parsing needed since we don't have a date date
            const parseTime = (dateBase: string, timeString: string) => {
                const d = new Date(dateBase + 'T00:00:00'); // Dummy
                // We rely on the string "9:00 AM" -> standard JS Date parsing might fail without full string
                // Let's use a helper or simple logic assuming format is consistent
                // Actually, the current format seems to be "8:00 AM" etc.
                const [time, period] = timeString.split(' ');
                let [hours, minutes] = time.split(':').map(Number);
                if (period === 'PM' && hours !== 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;

                // Construct date object in local time (server time)
                // WARNING: Timezones are tricky. The app seems to use 'Asia/Kolkata' for checks.
                // We should ideally use a library like date-fns-tz but let's stick to native strictly.
                // We will assume server time is close enough or use the same offset.
                const target = new Date();
                target.setHours(hours, minutes, 0, 0);

                // If we are looking for "tomorrow", add a day
                if (dateBase === tomorrowStr) {
                    target.setDate(target.getDate() + 1);
                }
                return target;
            };

            // Check today
            let doseTime = parseTime(todayStr, timeStr);
            if (doseTime > now) {
                if (!nearestTime || doseTime < nearestTime) {
                    nearestTime = doseTime;
                }
            } else {
                // If passed today, check tomorrow (simplest assumption for daily meds)
                const tomorrowDose = parseTime(tomorrowStr, timeStr);
                // Actually valid for all, we always want to find the minimal future time
                if (!nearestTime || tomorrowDose < nearestTime) {
                    nearestTime = tomorrowDose;
                }
            }
        }
    }

    return nearestTime;
};

export const checkAndSendMedicationReminders = async () => {
    try {
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });

        console.log(`[Scheduler] Polling Check at ${currentTime}...`);

        // 1. Fetch active medication schedules
        const { data: schedules, error: schedError } = await supabase
            .from('medication_schedules')
            .select(`
                id,
                exact_times,
                medication_id,
                user_id,
                medications (
                    drug_name,
                    dosage,
                    status
                )
            `)
            .eq('medications.status', 'active');

        if (schedError) {
            console.error('[Scheduler] Error fetching schedules:', schedError);
            return;
        }

        if (!schedules || schedules.length === 0) return;

        for (const sched of schedules) {
            const med: any = sched.medications;
            if (!med) continue;

            const times = sched.exact_times as string[];

            if (times.includes(currentTime)) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('email')
                    .eq('id', sched.user_id)
                    .single();

                if (userError || !userData?.email) {
                    console.warn(`[Scheduler] No email found for user ${sched.user_id}`);
                    continue;
                }

                console.log(`[Scheduler] Sending reminder to ${userData.email} for ${med.drug_name}`);

                await sendMedicationEmail(
                    userData.email,
                    med.drug_name,
                    med.dosage,
                    currentTime
                );
            }
        }

    } catch (error) {
        console.error('[Scheduler] Critical error:', error);
    }
};

/**
 * Auto-mark doses as 'missed' if overdue by 10+ minutes with no intake logged today.
 * Runs every poll cycle alongside reminders.
 */
export const checkAndMarkMissedDoses = async () => {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // 1. Fetch all active schedules with medication info
        const { data: schedules, error: schedError } = await supabase
            .from('medication_schedules')
            .select(`
                id,
                exact_times,
                medication_id,
                user_id,
                medications (
                    drug_name,
                    dosage,
                    form,
                    frequency_text,
                    status
                )
            `)
            .eq('medications.status', 'active');

        if (schedError || !schedules || schedules.length === 0) return;

        // 2. Fetch today's intakes for all users (batch)
        const { data: todayIntakes, error: intakeError } = await supabase
            .from('medication_intakes')
            .select('schedule_id, scheduled_time, status')
            .gte('taken_time', `${today}T00:00:00`)
            .lte('taken_time', `${today}T23:59:59`);

        if (intakeError) {
            console.error('[Scheduler] Error fetching intakes for miss-check:', intakeError);
            return;
        }

        let missedCount = 0;

        for (const sched of schedules) {
            const med: any = sched.medications;
            if (!med) continue;

            const times = sched.exact_times as string[];
            if (!times || !Array.isArray(times)) continue;

            for (const timeStr of times) {
                // Parse the scheduled time (supports "08:00", "8:00 AM", "21:00")
                let hours: number, minutes: number;
                if (timeStr.includes('AM') || timeStr.includes('PM')) {
                    const [timePart, period] = timeStr.split(' ');
                    [hours, minutes] = timePart.split(':').map(Number);
                    if (period === 'PM' && hours !== 12) hours += 12;
                    if (period === 'AM' && hours === 12) hours = 0;
                } else {
                    [hours, minutes] = timeStr.split(':').map(Number);
                }

                const doseTime = new Date();
                doseTime.setHours(hours, minutes, 0, 0);

                const diffMs = now.getTime() - doseTime.getTime();
                const diffMins = diffMs / 60000;

                // Only process if overdue by 10+ minutes (and not a future dose)
                if (diffMins < 10) continue;

                // Check if there's already an intake (taken or missed) for this schedule + time today
                const alreadyLogged = todayIntakes?.some(intake =>
                    intake.schedule_id === sched.id &&
                    intake.scheduled_time?.includes(timeStr)
                );

                if (alreadyLogged) continue;

                // Mark as missed
                const { error: insertError } = await supabase
                    .from('medication_intakes')
                    .insert({
                        user_id: sched.user_id,
                        schedule_id: sched.id,
                        drug_name: med.drug_name,
                        dosage: med.dosage,
                        form: med.form,
                        frequency_text: med.frequency_text,
                        scheduled_time: timeStr,
                        taken_time: now.toISOString(),
                        status: 'missed',
                    });

                if (!insertError) {
                    missedCount++;
                    console.log(`[Scheduler] ⏰ Marked MISSED: ${med.drug_name} (${timeStr}) for user ${sched.user_id}`);
                } else {
                    console.warn(`[Scheduler] Failed to mark missed:`, insertError.message);
                }
            }
        }

        if (missedCount > 0) {
            console.log(`[Scheduler] Marked ${missedCount} dose(s) as missed this cycle.`);
        }

    } catch (error) {
        console.error('[Scheduler] Miss-check critical error:', error);
    }
};

/**
 * Core Scheduling Loop
 */
const scheduleNextRun = async () => {
    if (schedulerTimeout) clearTimeout(schedulerTimeout);

    // 1. Check/Send reminders NOW (Poll)
    await checkAndSendMedicationReminders();

    // 1.5 Auto-mark overdue doses as missed
    await checkAndMarkMissedDoses();

    // 2. Decide next run time
    const nextDoseTime = await getNextScheduledTime();

    let delay = 60000; // Default: 1 minute (Polling mode)

    if (nextDoseTime) {
        const now = new Date();
        const diffMs = nextDoseTime.getTime() - now.getTime();
        const diffMinutes = diffMs / 60000;

        // If next dose is far away (> 10 mins), sleep until 10 mins before
        if (diffMinutes > 10) {
            const sleepMs = diffMs - (10 * 60000);
            console.log(`[Scheduler] Next dose at ${nextDoseTime.toLocaleTimeString()}. Sleeping for ${Math.round(sleepMs / 60000)} minutes.`);
            delay = sleepMs;
            isPolling = false;
        } else {
            console.log(`[Scheduler] Next dose in ${Math.round(diffMinutes)} mins. Polling active.`);
            isPolling = true;
            delay = 60000; // Poll every minute
        }
    } else {
        console.log('[Scheduler] No future doses found. Checking again in 1 minute.');
        delay = 60000;
    }

    // Safety clamp (max sleep 6 hours to handle new additions missed by refresh/failsafe)
    if (delay > 6 * 60 * 60 * 1000) delay = 6 * 60 * 60 * 1000;

    schedulerTimeout = setTimeout(scheduleNextRun, delay);
};


export const startMedicationScheduler = async () => {
    if (schedulerTimeout) return;
    console.log('[Scheduler] Starting Smart Scheduler...');
    scheduleNextRun();
};

export const stopMedicationScheduler = () => {
    if (schedulerTimeout) {
        clearTimeout(schedulerTimeout);
        schedulerTimeout = null;
        console.log('[Scheduler] Scheduler stopped.');
    }
};

export const refreshSchedulerState = async () => {
    console.log('[Scheduler] State refresh requested (New Med/Taken). Restarting logic...');
    stopMedicationScheduler();
    startMedicationScheduler();
};
