import WebSocket, { Server }  from 'ws';


export class WsMockBuilder {
  private readonly server: Server;
  private readonly onMessageHandlers: { (socket: WebSocket, msg: any): void; } [] = [];

  constructor(port: number) {
    this.server = new Server({
      port
    });
  }

  public echoOnMessage(delay: number = 1): WsMockBuilder {
    this.onMessageHandlers.push((socket, msg) => {
      setTimeout(()=>socket.send(msg), delay)
    });

    return this;
  }



  public closeOnMessage(code?: number, reason?: string): WsMockBuilder {
    this.onMessageHandlers.push((socket, _) => {
        socket.close(code, reason)
    });

    return this;
  }


  public onMessage(handler: ((socket: WebSocket, msg: any) => void)): WsMockBuilder {
    this.onMessageHandlers.push(handler);

    return this;
  }

  public start(): Server {

    this.server.on('connection', socket => {
      socket.on('message', msg => {
        this.onMessageHandlers.forEach(x => x.call(socket, socket, msg));
      });
    });

    return this.server;
  }
}