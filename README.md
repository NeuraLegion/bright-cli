# NexPloit CLI

NexPloit CLI is a [CLI](https://en.wikipedia.org/wiki/Command-line_interface)
tool that can initialize, stop, polling and maintain scans in NeuraLegions solutions (Such as NexPloit). 

Some NexPloit CLI features:

- Support official API
- Configuration in JSON / XML / YML / JS formats
- Generate .HAR based on handy schema declaration in separate mock files

## Table of Contents

 * [Installing NexPloit CLI](#installing-nexploit-cli)
 * [CLI command-language syntax](#cli-command-language-syntax)
 * [Configuration files](#configuration-files)
 * [Quick Start](#🚀-quick-start)
 * [Command Overview](#command-overview)
    + [Upload Archive](#📥-upload-archive)
    + [Generate Archive based on NexMock](#🧬🛠️-generate-archive-based-on-nexmock)
    + [Run Scan](#🏃-run-scan)
    + [Check Scan's status](#🚓-check-scans-status)
    + [Stop Scan](#🛑-stop-scan)
    + [Retest Scan](#🔁-retest-scan)
 * [License](#📝-license)

## Installing NexPloit CLI

Major versions of NexPloit CLI follow the supported major version of NexPloit.

Install the CLI using the npm package manager:

```bash
npm install -g @neuralegion/nexploit-cli
```
For details about changes between versions, and information about updating from previous releases, see the Releases tab on GitHub: https://github.com/NeuraLegion/nexploit-cli/releases

## CLI command-language syntax

NexPloit CLI accepts a wide variety of configuration arguments, run `nexploit-cli --help` for thorough documentation.
Configuration arguments on the command-line should be provided later to the program that NexPloit CLI is executing.

`nexploit-cli command_name required_arg [optional_arg] [options]`
* Most commands, and some options, have aliases. Aliases are shown in the syntax statement for each command.
* Option names are prefixed with a double dash (--). Option aliases are prefixed with a single dash (-). Arguments are not prefixed. For example:
```bash
nexploit-cli scan:stop --api-key my-api-kye my-scan-id
```
* Typically, the generated artifact can be given as an argument to the command or specified with the `--archive` option (See `archive:generate`).

### Configuration files

Any configuration options that can be set via the command line can also be specified in the `nexploit` stanza of your package.json, or within a seperate configuration file - a variety of flavors are available:

| File name       | File Association |
|-----------------|------------------|
| `.nexploit`        | JSON             |
| `.nexploit.json`   | JSON             |
| `.nexploit.yaml`   | YAML             |
| `.nexploit.yml`    | YAML             |
| `nexploit.config.js` | CommonJS export  |

See `nexploit-cli --help` for all options available.
You can set these in any of the files listed above, or from the command line.

## 🚀 Quick Start

Starting with NexPloit CLI is easy.

First, install NexPloit CLI globally:

```bash
npm install @neuralegion/nexploit-cli -g
```

Next, go to the directory of your project and run the command:

```bash
nexploit-cli -h
```

If you already have a prepared mock file, you can generate a HAR file with the following command:

```bash
nexploit-cli archive:generate \
    --mockfile .nexmock \
    --archive archive.har \
    --target url-tested-application \
    --header "Authorization: Bearer my-jwt-authentication-token"
```

Where `mockfile` is the path to your mockfile and `archive` is the path to save the HAR file to.

The [archive:generate](#🧬🛠️-generate-archive-based-on-nexmock) command will generate a new archive at the archive path:

```
Project
├── .nexploitrc       // CLI configuration
├── .nexmock          // your mock requests
└── archive.har       // generated HAR file
```

> ✴ In addition, you can specify authorization or authentication headers and a base url for the tested application.

During the creating of the archive, you can edit the `.nexploitrc.json` file and add your own options, such as:

```json
{
  "api-key": "my-jwt-authentication-token",
  "target": "url-tested-application",
  "timeout": 5000,
  "pool": 100,
  "host-filter": ["hostname-application"]
}
```

> ✴ You can also declare one of following .nexploitrc, .nexploitrc.json, .nexploitrc.yml, .nexploitrc.yaml, nexploit.config.js files.

However, most of the time you'll only need to configure api-key, target and maybe host-filter options.

Once the configuration is completed, upload a .HAR (or OAS) file with:

```bash
nexploit-cli archive:upload \
      --discovery archive \
      archive.har
```

The [archive:upload](#📥-upload-archive) command will output ID of new archive, which you can use to run a new scan:

```bash
nexploit-cli scan:run \
      --name scan-name \
      --archive received-archive-id \
      --protocol http \
      --api-key my-jwt-authentication-token
```

That's it, a new scan will start (or queued) in [NexPloit](https://nexploit.app).
You can continue to work with this scan in application.

## Command Overview

This section contains information on using NexPloit CLI's commands.

### 📥 Upload Archive

`nexploit-cli archive:upload [options] <file>` uploads passed .HAR/.WSAR (or OAS) into your [NeuraLegion Storage](https://nexploit.app/storage).

> ✴ If you plan to upload OAS file in the storage, you can specify a different discovery option by setting the `--discovery` to `oas`.

The command will output ID of new archive, which you can use to run a new scan.

> ✴ If the archive already exist with that name you'll receive following error message: `The file with that name already exists or the HAR/WSAR file is corrupted.`

#### Arguments

| Argument  |  Description |
|---|:---|
| `<file>` | The collection your app's http/websockets logs into .HAR or .WSAR file. Usually you can use browser dev tools or our browser web extension to generate them. Also, you can use OAS file that describe your public API. |

#### Options

| Option  |   Description |
|---|:---|
| `--api-key=yourApiKey`, `-K=yourApiKey` | The unique identifier used to authenticate a user that can be issued in your organization dashboard |
| `--discovery=archive/oas` | The discovery strategy to help determine better way to parse passed file. Default: `archive`|
| `--discard=false/true`, `-d=false/true` | When `true`, removes an archive after scan running. Default: `true` |
| `--header=extraHeader`, `-H=extraHeader` | Adds extra headers to passed OAS file. Also, it allows to remove an header by giving a replacement without content, as in: `-H "Host:"`. **WARNING**: headers set with this option will be set in all requests |

### 🛠️ Generate Archive based on NexMock

`nexploit-cli archive:generate [options]` creates HTTP Archive (HAR) files from mock requests generated by 
unit-testing and other local automations. 
Supports the latest [NexMock](https://www.npmjs.com/package/@neuralegion/nexmock) API and provides additional features to help you generate HAR files during CI/CD flows with ease.

Provides the ability to split NexMock file into multiply HAR files. For this purpose, you should specify `--split` option, that accepts the number of chunks.

```bash
nexploit-cli archive:generate \
  -m .nexmock \
  -f archive.har \
  -t url-tested-application \
  -s 4
```

The command will create 4 .HAR files which comply with following pattern: `<basename>(_<number>)?.<extension>`. 
E.g. `archive.har`, `archive_2.har` and etc.

#### Options

| Option  |   Description |
|---|:---|
| `--archive=newArchivePath`, `-f=newArchivePath` | The path where new archives will be created, relative to the new workspace root. |
| `--mockfile=nexmockPath`, `-m=nexmockPath` | NexMock file is obtained from the NexMock Reporters. See [E2E Guide](https://github.com/NeuraLegion/nexploit-cli/wiki/End-to-End-Guide#karma-or-mocha) |
| `--target=hostnameOrIp`, `-t=hostnameOrIp` | The target hostname or IP address. |
| `--header=extraHeader`, `-H=extraHeader` | Adds extra headers to passed NexMock file. Also, it allows to remove an header by giving a replacement without content, as in: `-H "Host:"`. **WARNING**: headers set with this option will be set in all requests |
| `--pool=size`, `-p=size` | The size of the worker pool. Indicates how many requests NexPloit CLI can performs at once. Default: `250` |
| `--timeout=milliseconds` | The time to wait for a server to send response headers (and start the response body) before aborting the request. Default: `5000` |
| `--split=numberChunks`, `-s=numberChunks` | The number of the HAR chunks. Allows to split a NexMock file to into multiple HAR files. Default: `1` |

### 🏃 Run Scan

`nexploit-cli scan:run [options] <archiveID>` starts a new scan for the received configuration. 

> ✴ NeuraLegions solutions (Such as NexPloit) provide opportunities to run scan immediately, schedule a future running and put it in the queue.

The command allows to specify one of discovery strategy. This means that you can handle client side dynamic content, javascript, and etc using `--crawler` option or just use generated .HAR/.WSAR files, or 
both at the same time.

#### Options

| Option  |   Description |
|---|:---|
| `--api-key=yourApiKey`, `-K=yourApiKey` | The unique identifier used to authenticate a user that can be issued in your organization dashboard |
| `--name=extraHeader`, `-n=extraHeader` | The name of the scan. |
| `--archive=archiveID`, `-a=archiveID` | The Archive ID can be received via `archive:upload` command. |
| `--crawler=url`, `-c=url` | Allows to specify a list of specific urls that should be included into crawler. |
| `--protocol=http/websocket`, `-p=http/websocket` | The exploited protocol. Default: `http` |
| `--type=appscan/protoscan` | The type of scan. Default: `appscan` |
| `--module=core/exploratory` | The `core` module tests for specific scenarios, mainly OWASP top 10 and other common scenarios. The `exploratory` module generates various scenarios to test for unknown vulnerabilities, providing automated AI led fuzzing testing. This module can be coupled with the agent to find additional vulnerabilities. Default: `core` |
| `--host-filter=hostOrIp`, `-F=hostOrIp` | The list of specific hosts that should be included into scan. |
| `--header=extraHeader`, `-H=extraHeader` | Adds extra headers to passed Archive. Also, it allows to remove an header by giving a replacement without content, as in: `-H "Host:"`. **WARNING**: headers set with this option will be set in all requests |

### 🚓 Check Scan's status

`nexploit-cli scan:polling [options] <scan>` allows to configure a polling of scan status and helps you follow to the scans during CI/CD flows. 

After the launch, it will check the scan's status most of the time.  If the scan finds at least of one medium severity issue, NexPloit CLI will finish with exit code `50`.

#### Arguments

| Argument  |  Description |
|---|:---|
| `<scan>` | The ID of an existing scan which you want to check. |

#### Options

| Option  |   Description |
|---|:---|
| `--api-key=yourApiKey`, `-K=yourApiKey` | The unique identifier used to authenticate a user that can be issued in your organization dashboard |
| `--failure-on=first-issue / first-medium-severity-issue / first-high-severity-issue.` | The predefined failure strategy that allows to finish process with exit code `50` only after fulfilling the condition. Default: `first-issue`|
| `--interval=milliseconds.` | The period of time between the end of a timeout period or completion of a scan status request, and the next request for status. Default: `5000` |

### 🛑 Stop Scan

`nexploit-cli scan:stop [options] <scan>` stops the scan by id.

#### Arguments

| Argument  |  Description |
|---|:---|
| `<scan>` | The ID of an existing scan which you want to stop. |

#### Options

| Option  |   Description |
|---|:---|
| `--api-key=yourApiKey`, `-K=yourApiKey` | The unique identifier used to authenticate a user that can be issued in your organization dashboard |

### 🔁 Retest Scan

`nexploit-cli scan:retest [options] <scan>` re-run the scan by id.

#### Arguments

| Argument  |  Description |
|---|:---|
| `<scan>` | The ID of an existing scan which you want to re-run. |

#### Options

| Option  |   Description |
|---|:---|
| `--api-key=yourApiKey`, `-K=yourApiKey` | The unique identifier used to authenticate a user that can be issued in your organization dashboard |

## 📝 License

Copyright © 2019 [NeuraLegion](https://github.com/NeuraLegion).

This project is licensed under the MIT License - see the [LICENSE file](LICENSE) for details.
