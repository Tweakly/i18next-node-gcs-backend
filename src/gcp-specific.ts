import { type Bucket, type File, Storage } from '@google-cloud/storage';
import { StorageOptions } from '@google-cloud/storage/build/cjs/src/storage';
import { readFile } from 'fs/promises';

/**
 * Configuration for the Google Cloud Storage bucket.
 *
 * The contents of this file is based on the corresponding file in the
 * https://github.com/John98Zakaria/nx-remotecache-gcp by John Sorial
 *
 */

/**!
 * Configuration type for GCP Storage.
 */
export type GCPBucketIdentifier = {
    googleProject: string;
    bucketName: string;
    googleApplicationCredentialsPath?: string;
    apiEndpoint?: string;
};

/**!
 * Combines the environment variable configuration with the options provided via i18next
 * @param options object containing the GCP Storage configuration
 */
export function buildConfiguration(
    options: Partial<GCPBucketIdentifier>,
): Partial<GCPBucketIdentifier> {
    const bucketName =
        process.env.BACKEND_GCP_BUCKET_NAME ?? options?.bucketName;
    const projectId = process.env.BACKEND_GCP_PROJECT ?? options?.googleProject;
    // If none was provided, we will let the Google library figure do its logic in finding the credentials
    // https://cloud.google.com/docs/authentication/application-default-credentials
    const googleApplicationCredentialsPath =
        process.env.BACKEND_GOOGLE_APPLICATION_CREDENTIALS_PATH ??
        options?.googleApplicationCredentialsPath;

    return {
        bucketName,
        googleProject: projectId,
        googleApplicationCredentialsPath,
        apiEndpoint: options.apiEndpoint
    };
}

/**!
 * Verifies that all required configurations have been provided
 * @param options object containing the GCP Storage configuration
 * */
export function verifyConfiguration(
    options: Partial<GCPBucketIdentifier>,
): GCPBucketIdentifier {
    const bucketName = options?.bucketName;
    const projectId = options?.googleProject;

    if (bucketName === undefined) {
        throw new Error(
            'You forgot to specify a google bucket name,' +
                ' please check your options or ' +
                'set the environment variable BACKEND_GCP_BUCKET_NAME',
        );
    }
    if (projectId === undefined) {
        throw new Error(
            'You forgot to specify a google project,' +
                ' please check your options or ' +
                'set the environment variable BACKEND_GCP_PROJECT',
        );
    }

    return {
        bucketName,
        googleProject: projectId,
        googleApplicationCredentialsPath:
            options.googleApplicationCredentialsPath,
        apiEndpoint: options.apiEndpoint
    };
}

/**
 * Gets a reference to the Google bucket and verifies its existence
 * @param configuration a configuration identifying the Google bucket
 */
export async function getGCSBucket(configuration: GCPBucketIdentifier) {
    const bucketName =
        process.env.BACKEND_GCP_BUCKET_NAME ?? configuration.bucketName;
    const googleStorageOptions: StorageOptions = {
        projectId: configuration.googleProject,
        retryOptions: {
            autoRetry: true,
            maxRetries: 4,
        },
    };

    // Generally for testing
    if (configuration.apiEndpoint) {
        googleStorageOptions.apiEndpoint = configuration.apiEndpoint;
        delete googleStorageOptions.projectId;
    }

    if (configuration.googleApplicationCredentialsPath) {
        try {
            googleStorageOptions.credentials = JSON.parse(
                await readFile(
                    configuration.googleApplicationCredentialsPath,
                    'utf-8',
                ),
            );
        } catch (error) {
            if (
                error instanceof Error &&
                'code' in error &&
                error.code === 'ENOENT'
            ) {
                throw Error(
                    `Was unable to find the authentication file located at ${configuration.googleApplicationCredentialsPath}`,
                );
            }
            if (error instanceof SyntaxError) {
                throw Error(
                    `The provided file at ${configuration.googleApplicationCredentialsPath} does not contain valid JSON`,
                );
            }
            throw error;
        }
    }

    const storageClient = new Storage(googleStorageOptions);
    const bucket = storageClient.bucket(bucketName);

    const [bucketExists] = await bucket.exists();
    if (!bucketExists) {
        throw Error(`The given Bucket ${bucketName} does not exist`);
    }

    return bucket;
}

/**
 * Constructs a reference to a Google bucket file
 * @param bucket
 * @param filename
 */
export function constructGCSFileReference(bucket: Bucket, filename: string) {
    return bucket.file(filename);
}

/**
 * Checks whether a file exists in a bucket
 * @param bucketFile Reference to file in a bucket
 */
export async function bucketFileExists(bucketFile: File): Promise<boolean> {
    const [exists] = await bucketFile.exists();
    return exists;
}

export async function readBucketFile(bucketFile: File): Promise<string> {
    const [data] = await bucketFile.download();
    return data.toString();
}