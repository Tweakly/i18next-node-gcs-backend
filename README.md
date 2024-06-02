# Introduction 
This is a backend for i18next that loads translations from Google Cloud Storage for use in Node.js.

Only JSON files with .json extension are supported and only reading is supported.
Multiloading requires the i18next-multiload-backend-adapter to be used.

# Getting started
This package can be installed by your favourite package manager, e.g. pnpm.

```bash
pnpm add @tweakly/i18n-node-gcs-backend
```

Wiring up:
```js
import i18next from 'i18next';
import Backend from '@tweakly/i18next-node-gcs-backend';

i18next.use(Backend).init(options);
```

# Options
Note: Environment variables have precedence over configured variables where both exists.

| Parameter                   | Description                                     | Environment Variable / .env                   | Options                            |
|-----------------------------|-------------------------------------------------|-----------------------------------------------|------------------------------------|
| Google Project              | Project Name in which the Bucket resides        | `BACKEND_GCP_PROJECT`                         | `googleProject`                    |
| Bucket Name                 | Bucket name in which the cache will be stored   | `BACKEND_GCP_BUCKET_NAME`                     | `bucketName`                       |
| Credentials path (optional) | Provide your own google application credentials | `BACKEND_GOOGLE_APPLICATION_CREDENTIALS_PATH` | `googleApplicationCredentialsPath` |

The credentials used to connect to the GCS bucket needs to have the storage.buckets.get permission. 

All options that can be provided are shown below.

```js
{
  // path where resources get loaded from, or a function
  // returning a path:
  // function(lngs, namespaces) { return customPath; }
  // the returned path will interpolate lng, ns if provided like giving a static path
  // the function might return a promise
  // returning falsy will abort the download
  //
  // If not used with i18next-multiload-backend-adapter, lngs and namespaces will have only one element each,
  // If used with i18next-multiload-backend-adapter, lngs and namespaces can have multiple elements
  //   and also your server needs to support multiloading
  //      /locales/resources.json?lng=de+en&ns=ns1+ns2
  //   Adapter is needed to enable MultiLoading https://github.com/i18next/i18next-multiload-backend-adapter
  //   Returned JSON structure in this case is
  //   {
  //    lang : {
  //     namespaceA: {},
  //     namespaceB: {},
  //     ...etc
  //    }
  //   }
  // By default, this backend will look in the root of the bucket
  // NOTE: If no services is provided to the backend, no attempt will be made towards
  //   interpolating the loadPath and it will be ignored. The resulting file name
  //   will match the default loadPath pattern.  
  loadPath: '{{lng}}/{{ns}}.json',

  // parse data after it has been fetched
  // in example use https://www.npmjs.com/package/json5
  // here it removes the letter a from the json (bad idea)
  parse: function(data) { return data.replace(/a/g, ''); },
    
  // The id of the Google project where the bucket is. This can also be set by env variable
  // BACKEND_GCP_PROJECT. It is required in one of the forms.  
  googleProject: "the-project-id",
  
  // The name of the bucket where the translation files live. This can also be set by env variable
  // BACKEND_GCP_BUCKET_NAME. It is required in one of the forms.    
  bucketName: "translations-bucket",
        
  // The application credentials needed to connect to the GCP Storage bucket. This can also be set by env
  // variable BACKEND_GOOGLE_APPLICATION_CREDENTIALS_PATH.
  // NOTE: When deployed in GCP, credentials will if not provided be picked up from the
  //   cloud execution environment by the underlying client libraries.      
  googleApplicationCredentialsPath: "/somepath/credentials.json"
}
```

Options can be passed in:

**preferred** - by setting options.backend in i18next.init:

```js
import i18next from 'i18next';
import Backend from '@tweakly/i18next-node-gcs-backend';

i18next.use(Backend).init({
  backend: options,
});
```

on construction:

```js
import Backend from '@tweakly/i18next-node-gcs-backend';
const Backend = new Backend(null, options);
```

via calling init:

```js
import Backend from '@tweakly/i18next-node-gcs-backend';
const Backend = new Backend();
Backend.init(null, options);
```

# Development
pnpm is used as package manager and ava for unit tests. The unit tests uses testcontainers to be able to use
the fsouza/fake-gcs-server to simulate a GCS bucket, so docker is required to run the tests.

100% test coverage is required for the main functionality in index.ts. The GCP Specific code has been manually tested for most
of the error cases, and is also mostly the same as the one in nx-remotecache-gcp. It is otherwise approximately 75% covered by the unittests.

Help in any way is appreciated!

# Acknowledgements
A big thanks to @John98Zakaria/nx-remotecache-gcp for the GCS connection code. 