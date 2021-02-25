# NexPloit CLI

**NexPloit CLI** is a Command Line Interface ([CLI](https://en.wikipedia.org/wiki/Command-line_interface)) tool for [NeuraLegion's solutions](https://www.neuralegion.com). You can use **NexPloit CLI** for full control over scans such as: initialize, stop, poll, maintain and more. In addition, **NexPloit CLI** can serve as a [Repeater](https://kb.neuralegion.com/#/deployment/repeater) to scan local targets, without exposing them to the internet.

##### Features:
- Supports official API
- Configurable using JSON / XML / YML / JS formats
- Can generate real interaction data (.har files) from mock interactions (Unit Tests), more info about NexMock [here](https://www.npmjs.com/package/@neuralegion/nexmock)
- Can serve as a [Repeater](https://kb.neuralegion.com/#/deployment/repeater) for communication from the cloud to a local target

## 🔎 Table of Contents
- [Quick Start](#🚀-quick-start)
- [Documentation](#📚-full-documentation)
- [License](#📝-license)

## 🚀 Quick Start
Before you can use **NexPloit CLI** make sure you have the following:
- An active user on www.nexploit.app
- A valid `TOKEN`
  - For the quick start these scopes are required: `bot`, `scans:run` and `scans:read`
  - More info about [setting up an API key](https://kb.neuralegion.com/#/user-guide/organization-administration/details-and-policies#managing-organization-api-keys)
- An active `ID`
  - More info about [Setting up a New Repeater](https://kb.neuralegion.com/#/user-guide/agents/overview.md)

#### 1. Install NexPloit CLI globally
```bash
npm install @neuralegion/nexploit-cli -g
```

You can validate the installation by going to the directory of your project and running the command:
```bash
nexploit-cli -h
```
This will show you a list of possible commands for NexPloit CLI, for a full list go [here](https://kb.neuralegion.com/#/nexploit-cli/commands)

#### 2. Activate the Repeater
```bash
nexploit-cli repeater \
  --token {TOKEN} \
  --id {ID} \
  --bus amqps://amq.nexploit.app:5672
```

#### 3. Start a new scan with a Crawler
```bash
nexploit-cli scan:run \
  --token {TOKEN} \
  --repeater {ID} \
  --name "My First Scan" \
  --crawler https://www.example.com \
  --smart
```
This command will initialize a new scan engine in the cloud, which will start scanning the target via the local [Repeater](https://kb.neuralegion.com/#/deployment/repeater).

#### 4. Check out the scan results
You can follow the scan status here: https://nexploit.app/scans, or by using the [NexPloit CLI polling](https://kb.neuralegion.com/#/commands.md#🚨-check-scan-status) command.

## 📚 Full Documentation
**NexPloit CLI** can do so much more! A full documentation with usage examples is available on [NeuraLegion's knowledgebase](https://kb.neuralegion.com)

## 📝 License
Copyright © 2020 [NeuraLegion](https://github.com/NeuraLegion).

This project is licensed under the MIT License - see the [LICENSE file](LICENSE) for details.
