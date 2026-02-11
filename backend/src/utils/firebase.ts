import admin from 'firebase-admin';
import { Auth } from 'firebase-admin/auth';

/**
 * Firebase Admin: use env vars on Vercel (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).
 * Private key in env should use literal \n for newlines; we replace \\n here.
 * Never throws at load so serverless can start; auth will fail at first use if misconfigured.
 */
function getFirebaseConfig(): { projectId: string; clientEmail: string; privateKey: string } | null {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
        return {
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
        };
    }

    // Local fallback (do not commit real keys; use .env or keep for local only)
    if (process.env.VERCEL === '1') {
        return null;
    }
    return {
        projectId: 'rexai-9f26f',
        clientEmail: 'firebase-adminsdk-fbsvc@rexai-9f26f.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDi7G3LpoYSYwmE\nSmA55JL5B5IPvHelCylKIMu4Wo3841kd4QTTfUUWcBrB9yzu93LSQV9LcdeMANj7\nnGb+C3PVjPR98n5qQCaiiTtxEHRHoecDUaoBIIuI/DJ+EwMggpkm+95XOXCtS4Lt\ns06lPOhJ1gE6vzv2CkQRFtqq4rYU1CASgFQQWOxBgnmw3i75d7a/nYpVC7SHxMts\n94mfOoTlvKbPm0vxGJO2jyYxk3/mEepJ72LT0zU4rdmo5ApebK+qdcMw8CynIf6F\n3PHEoeHce8rkA7+iToz1RtyR57DOiBKX0tPVOJGzDW3CHetf5WbgWQJGlbx1HafG\nPl4Om6bNAgMBAAECggEAA7yvm+v5IrJh+5i/ru/RuPR2P3hhh3cAlzc3VfII+N2f\nVs3qS256ju9THzLqKzy7tccA+OXQV1oMywbYgIJBM/RnTl1ljP4cm6DsXYmYQuwG\nFKHE8j+FGnf97XQq/JY3uXdYHZtVRdnnN180b+7FR2e5i3Vqfc5gC7wAeZsdV60C\nrwzyJlRMvmK2MpQd1cP36oV7zkY8+4F+XAP51McKhQklDdyCFMmuKpJO6u3mK0Lw\nPVUgfUVge49tDS/Pn7oVIHnHcZ/CduRkrPhvdWxdVz4z2rskAk62WGiUAkzXru2q\nxgACy+lCGGyeMsDa4uJ+j4w+ZZjew5pNzxTXSgG9jQKBgQD/clWZkscEHrfL9788\nw0kymo3S8vPnD7KIle8m9Ck2olnHEz+Jnf71smrgNmPjEkIS5at9zUfl9JyPEafd\n5CwosczNuSmynwVHgiEcZ15hXox1EiIinizB5mYdI1fxtQ3i/8ww7YpHzgOXlY1O\n9DiC7v5PmyaRSXPRMGVM7Auq/wKBgQDjaka0KBLSQM6smpV6l50FvWFvztpXpPUe\nQlWT3BhrN2/L8hFt6j/IT/+7Kpm3dOipadZJGEOIPcC0IdtO2EAfFWH9O8jlOWob\n1l6VDO5FDKFx274ylEbGsTRYJVZzfS9fAosSm6FX1DKn3fkp2ZNE+p4KTLsE1haL\neQ+io4VqMwKBgQD5NNHNwSPnIRCuLESlQt9mPuGdqufHw8io950Yo5qRclGjpWOX\nHkxd5nHdyzInlOhhBy8Gy/4YmUsjSFY8Yx2xlcP372x+liTQXmNvEmlBFLxyef5T\nR3ziraNxScnCRKAHlQXftd3xr0pR19TD8f4vvnjbsMEvfDlBG7W4FZBMgQKBgQCb\ne0LB05AirepfugSu30+c6ADhF5TSTVbFDGdEAzuyuiE2V9cwxfI7uu5GAfc8pbKY\neWLncK5jTI0e2vL88f7NAaqQHzrX9awlQihCUafqD5ulo65jGFtXZzo5dbWomhM0\nKyH4Y+0ohkzn1myO/1Gf3JUGx7UptlGNpARblt8VXwKBgFMHuT4TROAGlI+/LWvN\niTjRrAtWbD1oSfyzbektEZr2rAKpfbqB6uO5sb1CTsuR+VEivP7nXWjF60Fyt5Zd\nUEiZNOAJLPy9bVSae+CliTemeR50QoKMZODGSvqEhhCBXnCCQAwdwK9fqXrhFw+9\ntG2nYosBe+UG2Q0zHGDj8smW\n-----END PRIVATE KEY-----\n',
    };
}

if (!admin.apps.length) {
    const config = getFirebaseConfig();
    if (config) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert(config),
            });
            console.log('✅ Firebase Admin SDK initialized');
        } catch (error) {
            console.error('❌ Firebase Admin initialization error:', error);
        }
    } else if (process.env.VERCEL === '1') {
        console.warn('Firebase: Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Vercel env for auth.');
    }
}

/** Lazy: do not call admin.auth() at load—crashes on Vercel when no app is initialized. */
function getAuth(): Auth {
    if (!admin.apps.length) {
        throw new Error('Firebase not initialized. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Vercel.');
    }
    return admin.auth();
}

export const auth = new Proxy({} as Auth, {
    get(_, prop) {
        return (getAuth() as unknown as Record<string, unknown>)[prop as string];
    },
});
export default admin;
