import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY || 're_JurMZUjS_PUfFq5ypQxUQv9nPsCvxqyGU');

export const sendMedicationEmail = async (to: string, drugName: string, dosage: string, time: string) => {
    try {
        const { data, error } = await resend.emails.send({
            // User requested: "mail should be sent from email: fairosahmed.ai@gmail.com"
            // NOTE: You can only send from a verified domain on Resend. 
            // If fairosahmed.ai@gmail.com is not a verified domain (it's a gmail), it won't work directly.
            // We'll try to set it as 'reply_to' or 'from' if they have a custom domain setup, 
            // but usually 'onboarding@resend.dev' is the safe sandbox sender.
            // I will assume the user has configured this domain or wants it to appear this way.
            // However, sending from @gmail.com via Resend is generally not allowed without SMTP.
            // I'll stick to 'onboarding@resend.dev' for safety but add the user's name in the from label 
            // OR if they really want that email, I'll attempt it but it might fail if not verified.
            // Let's us 'RexAI <onboarding@resend.dev>' but reply-to as the user email.
            // Wait, the prompt said "sent from email: fairosahmed.ai@gmail.com". 
            // If I change the FROM, it will likely crash if not verified.
            // I'll use a safe fallback.
            from: 'RexAI <onboarding@resend.dev>',
            replyTo: 'fairosahmed.ai@gmail.com',
            to: [to],
            subject: `Medication Reminder: ${drugName}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #007AFF;">RexAI Medication Reminder 💊</h2>
                    <p>It's time to take your medication:</p>
                    <div style="background: #f0f7ff; padding: 15px; border-radius: 10px; border-left: 5px solid #007AFF;">
                        <strong style="font-size: 18px;">${drugName}</strong><br/>
                        <span>Dosage: ${dosage}</span><br/>
                        <span>Scheduled Time: ${time}</span>
                    </div>
                    <p style="margin-top: 20px;">Please open the app to mark it as taken.</p>
                </div>
            `
        });

        if (error) {
            console.error('[Resend] Error sending email:', error);
            return { success: false, error };
        }

        console.log('[Resend] Email sent successfully:', data?.id);
        return { success: true, id: data?.id };
    } catch (err: any) {
        console.error('[Resend] Fatal error:', err);
        return { success: false, error: err.message };
    }
};
