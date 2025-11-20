import 'reflect-metadata';
import { RunRepeater } from './RunRepeater';
import { type Cert } from '../RequestExecutor/Request';
import { CertificatesLoader } from '../RequestExecutor';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

describe('RunRepeater command builder', () => {
  let server: https.Server;

  beforeEach((done) => {
    server = https.createServer(
      {
        ca: fs.readFileSync(
          path.resolve(__dirname, '../../tests/data/certs/ca-cert.pem')
        ),
        cert: fs.readFileSync(
          path.resolve(__dirname, '../../tests/data/certs/server-cert.pem')
        ),
        key: fs.readFileSync(
          path.resolve(__dirname, '../../tests/data/certs/server-key.pem')
        ),
        requestCert: true,
        rejectUnauthorized: true
      },
      (req, res) => {
        if ((req as unknown as any).client.authorized) {
          res.writeHead(200);
          res.end('Hello authorized client');
        } else {
          res.writeHead(401);
          res.end('Client certificate required or invalid');
        }
      }
    );
    server.listen(0, done);
  });

  afterEach((done) => {
    server.close(done);
  });

  test('should accept valid certificate', async () => {
    const port = (server.address() as any).port;
    const cert: Cert = {
      path: path.resolve(__dirname, '../../tests/data/certs/client.pfx'),
      hostname: 'localhost',
      passphrase: '1234',
      port: port.toString()
    };
    await new CertificatesLoader().load(
      path.resolve(__dirname, '../../tests/data/certs/ca-cert.pem')
    );
    expect(await RunRepeater.isValidCertificate(cert)).toBe(true);
  });

  test('should reject certificate with wrong password', async () => {
    const port = (server.address() as any).port;
    const cert: Cert = {
      path: path.resolve(__dirname, '../../tests/data/certs/client.pfx'),
      hostname: 'localhost',
      passphrase: '3234',
      port: port.toString()
    };
    await new CertificatesLoader().load(
      path.resolve(__dirname, '../../tests/data/certs/ca-cert.pem')
    );
    expect(await RunRepeater.isValidCertificate(cert)).toBe(false);
  });

  test('should reject certificate with wrong CA', async () => {
    const port = (server.address() as any).port;
    const cert: Cert = {
      path: path.resolve(__dirname, '../../tests/data/certs/bad-client.pfx'),
      hostname: 'localhost',
      passphrase: '1234',
      port: port.toString()
    };
    await new CertificatesLoader().load(
      path.resolve(__dirname, '../../tests/data/certs/ca-cert.pem')
    );
    expect(await RunRepeater.isValidCertificate(cert)).toBe(false);
  });
});
