import {GenericContainer} from "testcontainers";
import { Storage } from "@google-cloud/storage";
import Backend from "../src";
import {InterpolationOptions, Interpolator, Services} from "i18next";
import test from "ava";

test.before(async () => {
    process.env.K_SERVICE = "test-service";
    process.env.BACKEND_GCP_PROJECT = "test-project";

    const bucketName = "test-bucket";
    const gcsPort = 4443;
    const gcsContainer = await new GenericContainer("fsouza/fake-gcs-server:1.49.1")
        .withEntrypoint(["/bin/fake-gcs-server", "-scheme", "http"])
        .withExposedPorts(gcsPort)
        .start();

    const apiEndpoint = `http://${gcsContainer.getHost()}:${gcsContainer.getMappedPort(
        gcsPort
    )}`;

    // Configure the fake GCS server
    await fetch(`${apiEndpoint}/_internal/config`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ externalUrl: apiEndpoint }),
    });

    const storage = new Storage({ apiEndpoint });
    await storage.createBucket(bucketName);
    const bucket = storage.bucket(bucketName);
    await bucket.upload("test/nb-NO.json", {
        destination: "nb-NO.json"
    });

    await bucket.upload("test/en-US.json", {
        destination: "somepath/en-US.json"
    });

    await bucket.upload("test/de-DE.json", {
        destination: "de-DE.json"
    });

    await bucket.upload("test/nb-NO.bar", {
        destination: "nb-NO.bar"
    });

    await bucket.upload("test/sv-SV.json", {
        destination: "sv-SV/backend.json"
    });


    process.env.GCS_API_ENDPOINT = apiEndpoint;
    process.env.BUCKET_NAME = bucketName;
});

const testBackend = async (t: any, backend: Backend, lng = "nb-NO", ns = "") => {
    try {
        await backend.read(lng, ns, (err, data) => {
            if (err) {
                throw err;
            }
            t.truthy(data);
        });
    }
    catch (e) {
        t.fail();
    }

    t.pass();
};


test("GCP integration, options in constructor", async (t) => {

    const apiEndpoint = process.env.GCS_API_ENDPOINT as string;
    const bucketName = process.env.BUCKET_NAME as string;

    const backend = new Backend({ interpolator: {
            interpolate(str: string, data: object, lng: string, options: InterpolationOptions): string { return `${lng}.json`; }
        } as Interpolator } as Services, {
        bucketName,
        apiEndpoint,
        loadPath: ""
    });

    await testBackend(t, backend);
});

test("GCP integration, options in init", async (t) => {

    const apiEndpoint = process.env.GCS_API_ENDPOINT as string;
    const bucketName = process.env.BUCKET_NAME as string;

    const backend = new Backend(null);
    backend.init({ interpolator: {
            interpolate(str: string, data: object, lng: string, options: InterpolationOptions): string { return `${lng}.json`; }
        } as Interpolator } as Services, {
        bucketName,
        apiEndpoint,
        loadPath: ""
    });

    await testBackend(t, backend);
});

test("that loadPath can be a function, including an async one", async (t) => {
    const apiEndpoint = process.env.GCS_API_ENDPOINT as string;
    const bucketName = process.env.BUCKET_NAME as string;

    const backend = new Backend(null);
    backend.init({ interpolator: {
            interpolate(str: string, data: object, lng: string, options: InterpolationOptions): string { return `${lng}.json`; }
        } as Interpolator } as Services, {
        bucketName,
        apiEndpoint,
        loadPath: () => { return ""; }
    });

    await testBackend(t, backend);

    const backend2 = new Backend(null);
    backend2.init({ interpolator: {
            interpolate(str: string, data: object, lng: string, options: InterpolationOptions): string { return `${lng}.json`; }
        } as Interpolator } as Services, {
        bucketName,
        apiEndpoint,
        loadPath: async () => { return Promise.resolve(""); }
    });

    await testBackend(t, backend2);
});

test("that namespaces are supported", async (t) => {
    const apiEndpoint = process.env.GCS_API_ENDPOINT as string;
    const bucketName = process.env.BUCKET_NAME as string;

    const backend = new Backend(null);
    backend.init(null, {
        bucketName,
        apiEndpoint,
        loadPath: () => {
            return "";
        }
    });

    await testBackend(t, backend, "sv-SV", "backend");
});


test("that services can be null", async (t) => {
    const apiEndpoint = process.env.GCS_API_ENDPOINT as string;
    const bucketName = process.env.BUCKET_NAME as string;

    const backend = new Backend(null);
    backend.init(null, {
        bucketName,
        apiEndpoint,
        loadPath: () => {
            return "";
        }
    });

    await testBackend(t, backend);

    const backend2 = new Backend(null);
    backend2.init(null, {
        bucketName,
        apiEndpoint,
        loadPath: () => {
            return "somepath";
        }
    });

    await testBackend(t, backend2, "en-US");
});

test("that callback get error on missing file", async (t) => {
    const apiEndpoint = process.env.GCS_API_ENDPOINT as string;
    const bucketName = process.env.BUCKET_NAME as string;

    const backend = new Backend(null);
    backend.init(null, {
        bucketName,
        apiEndpoint,
        loadPath: () => {
            return "foo";
        }
    });

    try {
        await backend.read("nb-NO", "", (err, data) => {
            t.truthy(err);
        });
    }
    catch (e) {
        t.pass();
    }
});

test("that bad JSON in translation files cause error", async (t) => {
    const apiEndpoint = process.env.GCS_API_ENDPOINT as string;
    const bucketName = process.env.BUCKET_NAME as string;

    const backend = new Backend(null);
    backend.init(null, {
        bucketName,
        apiEndpoint,
        loadPath: () => {
            return "";
        }
    });

    try {
        await backend.read("de-DE", "", (err, data) => {
            t.truthy(err);
        });
    }
    catch (e) {
        t.pass();
    }
});

test("that missing init cause error", async (t) => {
    const backend = new Backend(null);

    try {
        await backend.read("nb-NO", "", (err, data) => {
            t.truthy(err);
        });
    }
    catch (e) {
        t.pass();
    }
});

test("that missing storage bucket cause error", async (t) => {
    const apiEndpoint = process.env.GCS_API_ENDPOINT as string;
    const bucketName = "flachmatuch";

    const backend = new Backend(null);
    backend.init(null, {
        bucketName,
        apiEndpoint,
        loadPath: () => {
            return "";
        }
    });

    try {
        await backend.read("nb-NO", "", (err, data) => {
            t.truthy(err);
        });
    }
    catch (e) {
        t.pass();
    }
});

test("that unknown extension cause error", async (t) => {
    const apiEndpoint = process.env.GCS_API_ENDPOINT as string;
    const bucketName = process.env.BUCKET_NAME as string;

    const backend = new Backend(null);
    backend.init({ interpolator: {
            interpolate(str: string, data: object, lng: string, options: InterpolationOptions): string { return `${lng}.bar`; }
        } as Interpolator } as Services, {
        bucketName,
        apiEndpoint,
        loadPath: () => {
            return "{{lng}}.bar";
        }
    });

    try {
        await backend.read("nb-NO", "", (err, data) => {
            t.truthy(err);
        });
    }
    catch (e) {
        t.pass();
    }
});
