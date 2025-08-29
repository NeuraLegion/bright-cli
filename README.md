# Bright CLI

[Bright](https://brightsec.com) is a powerful dynamic application & API security testing (DAST) platform. With its effective automation and integration capabilities, Bright allows developers to scan multiple targets, uncover security vulnerabilities without false positives, get detailed reports on every finding, and quickly fix security issues by following the remediation guidelines.

The NPM allows you to install the Bright Command Line Interface (CLI) on your machine. You can use the **Bright CLI** to run and manage security scans directly from your development environment. In addition, the container includes a preconfigured [Repeater (scan proxy)](https://docs.brightsec.com/docs/on-premises-repeater-local-agent), which enables you to scan local targets securely, without exposing them to the Internet.

##### Features:

- Easy control of the Bright REST API.
- [Repeater mode](https://docs.brightsec.com/docs/on-premises-repeater-local-agent), which allows the Bright cloud engine to connect to local targets securely, pulling all scan requests as outbound traffic, without exposing the targets to the Internet.
- Flexible proxy configuration, which allows you to control the CLI requests both internally and externally.
- Connector to on-premises (local) ticketing services. For example, you can enable the Bright integration with on-premises Jira, for tickets to be automatically opened for each security vulnerability detected.
- Integration of Bright with your CI pipelines. Please see our [guide on integrating Bright with CI pipelines](https://docs.brightsec.com/docs/integrate-bright-with-your-cicd-pipeline) for more information.
- Running commands from a configuration file. You can run the CLI commands from your console or save them as a JSON, XML, YML, or JavaScript file. Running the CLI from a pre-configured file will simplify further scanning.

## 🔎 Table of Contents

- [Quick Start](#-quick-start)
- [Full Documentation](#-full-documentation)
- [License](#-license)

## 🚀 Quick Start

Before you can use **Bright CLI** make sure you have the following:

- An active user in [the Bright app](https://app.brightsec.com/)
- You have Docker installed on your machine.
- You have a valid [organization API key](https://docs.brightsec.com/docs/manage-your-organization#manage-organization-apicli-authentication-tokens) or a [personal API key](https://docs.brightsec.com/docs/manage-your-personal-account#manage-your-personal-api-keys-authentication-tokens) with the following scopes: `bot`, `scans:run` and `scans:read`. You can watch video about [creating API keys](https://www.youtube.com/watch?v=W_WdIGPXoUQ&t=3s).
- You have registered (created) a Repeater in the Bright app and copied the generated Repeater ID. For the instructions on how to register a Repeater, see [here](https://docs.brightsec.com/docs/manage-repeaters#create-a-new-repeater).
- You have copied the Bright Project ID under which you want to run a scan. A Project ID is required. If you do not have any custom projects, use the Default Project ID.

#### 1. Install Bright CLI globally

```bash
npm install @brightsec/cli -g
```

You can make sure the installation worked by executing the following command:

```bash
bright-cli --version
```

It should return the latest Bright CLI version.

#### 2. Activate the Repeater

```bash
bright-cli repeater \
  --token {TOKEN} \
  --id {ID}
```

#### 3. Start a new scan with a Crawler

```bash
bright-cli scan:run \
  --token {TOKEN} \
  --repeater {ID} \
  --name "Bright scan" \
  --crawler {TARGET_URL} \
  --project {PROJECT_ID}  \ #If you do not have any custom projects, specify the Default Project ID.
  --smart
```

This command will initialize a new scan engine on the cloud, which will start scanning the target in the Repeater mode.

We recommend that you use the `--smart` option to optimize the scan coverage and time. This enables you to use automatic smart decisions, such as parameter skipping, detection phases and so on.

#### 4. Check out the scan results

You can follow the scan status in the [Bright app](https://app.brightsec.com/scans) or by using the [**Bright CLI** polling](https://docs.brightsec.com/docs/cli-checking-scan-status) command.

## 📚 Full Documentation

The **Bright CLI** can do so much more! You can find a full guide with the usage examples in the [Bright docs](https://docs.brightsec.com/docs/about-bright-cli).

## 📝 License

Copyright © 2025 [Bright Security Inc.](https://brightsec.com/)

This project is licensed under the MIT License - see the [LICENSE file](LICENSE) for details.
