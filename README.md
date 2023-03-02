# Bright CLI

**Bright CLI** is a Command Line Interface ([CLI](https://en.wikipedia.org/wiki/Command-line_interface)) tool for [Bright's solutions](https://www.brightsec.com). You can use **Bright CLI** for full control over scans such as: initialize, stop, poll, maintain and more. In addition, **Bright CLI** can serve as a [Repeater](https://docs.brightsec.com/docs/on-premises-repeater-local-agent) to scan local targets, without exposing them to the internet.

##### Features:

- Supports official API
- Configurable using JSON / XML / YML / JS formats
- Can generate real interaction data (.har files) from mock interactions (Unit Tests), more info about NexMock [here](https://www.npmjs.com/package/@neuralegion/nexmock)
- Can serve as a [Repeater](https://docs.brightsec.com/docs/on-premises-repeater-local-agent) for communication from the cloud to a local target

## 🔎 Table of Contents

- [Quick Start](#🚀-quick-start)
- [Documentation](#📚-full-documentation)
- [License](#📝-license)

## 🚀 Quick Start

Before you can use **Bright CLI** make sure you have the following:

- An active user in [the Bright app](https://app.brightsec.com/)
- A valid `TOKEN`
  - For the quick start these scopes are required: `bot`, `scans:run` and `scans:read`
  - More info about [setting up an API key](https://docs.brightsec.com/docs/manage-your-organization#manage-organization-apicli-authentication-tokens)
- An active `ID`
  - More info about [Setting up a New Repeater](https://docs.brightsec.com/docs/manage-repeaters)

#### 1. Install Bright CLI globally

```bash
npm install @neuralegion/bright-cli -g
```

You can validate the installation by going to the directory of your project and running the command:

```bash
bright-cli -h
```

This will show you a list of possible commands for Bright CLI, for a full list go [here](https://docs.brightsec.com/docs/command-list)

#### 2. Activate the Repeater

```bash
bright-cli repeater \
  --token {TOKEN} \
  --id {ID} \
  --bus amqps://amq.app.brightsec.com:5672
```

#### 3. Start a new scan with a Crawler

```bash
bright-cli scan:run \
  --token {TOKEN} \
  --repeater {ID} \
  --name "My First Scan" \
  --crawler https://www.example.com \
  --smart
```

This command will initialize a new scan engine in the cloud, which will start scanning the target via the local [Repeater](https://docs.brightsec.com/docs/on-premises-repeater-local-agent).

#### 4. Check out the scan results

You can follow the scan status here: https://app.brightsec.com/scans, or by using the [Bright CLI polling](https://docs.brightsec.com/docs/checking-scan-status) command.

## 📚 Full Documentation

**Bright CLI** can do so much more! A full documentation with usage examples is available on [Bright's knowledgebase](https://docs.brightsec.com)

## 📝 License

Copyright © 2021 [Bright](https://github.com/NeuraLegion).

This project is licensed under the MIT License - see the [LICENSE file](LICENSE) for details.
