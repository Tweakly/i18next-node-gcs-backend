import {BackendModule, CallbackError, ReadCallback, Services} from "i18next";
import {extname} from "path";
import {Bucket} from "@google-cloud/storage";
import {
    buildConfiguration,
    constructGCSFileReference,
    GCPBucketIdentifier,
    getGCSBucket, readBucketFile,
    verifyConfiguration
} from "./gcp-specific";

export type GcpBackendOptions = {
    loadPath?: string | ((language: string, namespace: string) => string | Promise<string>);
    parse?: JSON['parse'];
} & Partial<GCPBucketIdentifier>;

export class Backend implements BackendModule<GcpBackendOptions> {
    static type: "backend" = "backend";
    type: "backend" = "backend";
    private bucket: Bucket | undefined;
    private verifiedConfiguration: GCPBucketIdentifier | undefined;
    private options: GcpBackendOptions;
    private services: Services | null;

    private readonly defaultOptions: GcpBackendOptions = {
        loadPath: '{{lng}}/{{ns}}.json',
        parse: JSON.parse,
    }

    private getBucket = async () => {
        if (!this.bucket && this.verifiedConfiguration) {
            this.bucket = await getGCSBucket(this.verifiedConfiguration);
        }
        return this.bucket;
    };

    constructor(services: Services | null, options?: GcpBackendOptions) {
        this.options = {
            ...this.defaultOptions,
            ...options
        };
        this.services = services;
        if (options) {
            this.init(services, options);
        }
        else {
            this.verifiedConfiguration = undefined;
        }
    }

    init(services: Services | null, options: GcpBackendOptions): void {
        this.options = {
            ...this.defaultOptions,
            ...options
        };
        this.services = services;
        this.bucket = undefined;
        const configuration = buildConfiguration(options);
        this.verifiedConfiguration = verifyConfiguration(configuration);
    }

    read = async (lng: string, ns: string, callback: ReadCallback): Promise<void> => {
        let loadPath = this.options.loadPath;
        if (typeof this.options.loadPath === 'function') {
            loadPath = await this.options.loadPath(lng, ns);
        }

        const filename = this.services ?
            this.services.interpolator.interpolate(loadPath as string, { lng, ns }, lng, {}) :
            ((loadPath: string, data: { lng: string, ns?: string }, lng: string, options: any) => {
               const filename = data.ns ? `${data.lng}/${data.ns}.json` : `${data.lng}.json`;
               if (loadPath) {
                   return `${loadPath}/${filename}`;
               }
               return filename;
            })(loadPath as string, { lng, ns }, lng, {});

        try {
            const { data } = await this.readFile(filename, { parse: this.options.parse! });
            callback(null, data);
        }
        catch (err) {
            callback(err as CallbackError, false);
        }
    }

    readFile = async (filename: string, options = { parse: JSON.parse }) => {
        const ext = extname(filename);
        const bucket = await this.getBucket();
        if (bucket) {
            const file = constructGCSFileReference(bucket, filename);
            const data = await readBucketFile(file);
            const [metadata] = await file.getMetadata();
            const stat = {
                mtime: new Date(metadata.timeCreated as string)
            };

            try {
                const ret = parseData(ext, data, options);
                return Promise.resolve({data: ret, stat});
            } catch (err: any) {
                if (err.message) {
                    err.message = 'error parsing ' + filename + ': ' + err.message;
                }
                return Promise.reject(err);
            }
        }
        else {
            return Promise.reject(new Error('No bucket available'));
        }
    }
}

Backend.type = 'backend'
export default Backend;

const parseData = (ext: string, data: string, options: { parse: (data: string) => any }) => {
    if (ext === '.json') {
        return options.parse(data)
    }
    throw new Error (`Unrecognized extension, only supports json files`);
};