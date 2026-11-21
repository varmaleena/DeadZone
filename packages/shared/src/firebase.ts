import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getRemoteConfig } from 'firebase/remote-config';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type AI, type GenerativeModel } from 'firebase/ai';
import { findingsJsonSchema, verdictJsonSchema } from './schemas';
import { rubricDefaults } from './config';

export type CloudTask = 'verdict' | 'diagnosis';

function createServices(config: FirebaseOptions, siteKey: string, debug: boolean) {
  if (debug) {
    // Development/judging builds only: prints a debug token to register in the Firebase console.
    (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  }
  const app: FirebaseApp = getApps()[0] ?? initializeApp(config);
  const appCheck: AppCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const ai: AI = getAI(app, { backend: new GoogleAIBackend() });

  /**
   * Screen verdicts during a sweep. ONLY_ON_DEVICE: the target may be offline, so this
   * must never reach the network. Structured output is enforced with responseConstraint.
   */
  const deviceModel = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: { expectedInputs: [{ type: 'text' }, { type: 'image' }] },
      promptOptions: { responseConstraint: verdictJsonSchema },
    },
  });

  /** Short explanations: on-device when available, otherwise cloud (automatic hybrid fallback). */
  const hybridModel = getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: { model: rubricDefaults.dz_cloud_model },
  });

  const cloudModels = new Map<string, GenerativeModel>();
  /**
   * Cloud models are created per Remote Config model name, so the model can be changed
   * without shipping a new build.
   */
  function cloudModel(modelName: string, task: CloudTask): GenerativeModel {
    const key = `${modelName}:${task}`;
    let model = cloudModels.get(key);
    if (!model) {
      model = getGenerativeModel(ai, {
        mode: InferenceMode.ONLY_IN_CLOUD,
        inCloudParams: {
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: task === 'verdict' ? verdictJsonSchema : findingsJsonSchema,
          },
        },
      });
      cloudModels.set(key, model);
    }
    return model;
  }

  return {
    app,
    appCheck,
    verifyAppCheck: async () => {
      await getToken(appCheck, true);
    },
    db,
    auth: getAuth(app),
    remoteConfig: getRemoteConfig(app),
    deviceModel,
    hybridModel,
    cloudModel,
  };
}

export type FirebaseServices = ReturnType<typeof createServices>;

let services: FirebaseServices | undefined;

export function initFirebase(config: FirebaseOptions, siteKey: string, debug = false): FirebaseServices {
  if (!config.projectId || !config.apiKey || !config.appId || !siteKey) {
    throw new Error('Configure Firebase and App Check in .env.local first.');
  }
  return (services ??= createServices(config, siteKey, debug));
}
