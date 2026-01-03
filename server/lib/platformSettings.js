import { connectToDatabase, getCollection } from './db.js';

export const SETTINGS_COLLECTION = 'platform_settings';
export const SETTINGS_DOCUMENT_ID = 'platform_config';

function readBooleanEnv(...names) {
    for (const name of names) {
        const raw = process.env[name];
        if (raw === undefined) continue;
        const value = String(raw).trim().toLowerCase();
        if (!value) continue;
        if (['1', 'true', 'yes', 'y', 'on'].includes(value)) return true;
        if (['0', 'false', 'no', 'n', 'off'].includes(value)) return false;
    }
    return undefined;
}

export function createDefaultPlatformSettings() {
    const paymentsEnabledOverride = readBooleanEnv('PAYMENTS_ENABLED', 'FEATURE_PAYMENTS_ENABLED');
    return {
        _id: SETTINGS_DOCUMENT_ID,
        general: {
            siteName: 'Blanc',
            supportEmail: 'support@blanc.com',
            maintenanceMode: false,
            defaultLanguage: 'vi',
            timezone: 'Asia/Ho_Chi_Minh',
        },
        notifications: {
            emailNotifications: true,
            pushNotifications: true,
            marketingEmails: false,
            systemAlerts: true,
        },
        security: {
            twoFactorRequired: false,
            sessionTimeout: 30,
            passwordMinLength: 8,
            maxLoginAttempts: 5,
            tokensInvalidBefore: null,
        },
        features: {
            contestsEnabled: true,
            coursesEnabled: true,
            teamsEnabled: true,
            paymentsEnabled: paymentsEnabledOverride ?? false,
        },
        updatedAt: new Date(),
        updatedBy: null,
    };
}

export async function getPlatformSettings() {
    await connectToDatabase();
    const collection = getCollection(SETTINGS_COLLECTION);

    let settings = await collection.findOne({ _id: SETTINGS_DOCUMENT_ID });
    if (!settings) {
        const defaults = createDefaultPlatformSettings();
        await collection.insertOne(defaults);
        settings = defaults;
    }

    const paymentsEnabledOverride = readBooleanEnv('PAYMENTS_ENABLED', 'FEATURE_PAYMENTS_ENABLED');
    if (paymentsEnabledOverride !== undefined) {
        settings.features = settings.features || {};
        settings.features.paymentsEnabled = paymentsEnabledOverride;
    }

    return settings;
}
