"use strict";

import { EventEmitter } from "events";
import * as shortid from "shortid";
import * as msgpack from "notepack.io";
import WebSocket from "../../src/ws";
import { Room } from "../../src/Room";

export class Client extends EventEmitter {

  public id: string;
  public messages: Array<any> = [];
  public readyState: number = WebSocket.OPEN;

  constructor (id?: string) {
    super();
    this.id = id || null;

    this.on('close', () => {
      this.readyState = WebSocket.CLOSED
    });
  }

  send (message) {
    this.messages.push(message);
  }

  get lastMessage () {
    return msgpack.decode(this.messages[ this.messages.length - 1 ]);
  }

  close () {
    this.messages = [];
    // this.emit('close');
  }

}

export function createEmptyClient(): any {
  return new Client()
}

export function createDummyClient (): any {
  return new Client(shortid.generate())
}

export class DummyRoom extends Room {
  requestJoin (options) {
    return !options.invalid_param
  }

  onInit () { this.setState({}); }
  onDispose() {}
  onJoin() {}
  onLeave() {}
  onMessage() {}
}

export class RoomWithError extends Room {
  onInit () { this.setState({}); }
  onDispose() {}
  onJoin() {
    (<any>this).iHaveAnError();
  }
  onLeave() {}
  onMessage() {}
}


export class DummyRoomWithState extends Room {
  constructor () {
    super();
    this.setState({ number: 10 });
  }

  requestJoin (options) {
    return !options.invalid_param;
  }

  onInit () {}
  onDispose() {}
  onJoin() {}
  onLeave() {}
  onMessage() {}
}

export class DummyRoomWithTimeline extends Room {
  constructor () {
    super();
    this.useTimeline()
  }


  requestJoin (options) {
    return !options.invalid_param
  }

  onInit () { this.setState({}); }
  onDispose() {}
  onJoin() {}
  onLeave() {}
  onMessage() {}
}

export class RoomVerifyClient extends DummyRoom {
  patchRate = 5000;
  onJoin () {}
}

export class RoomVerifyClientWithLock extends DummyRoom {
  patchRate = 5000;

  async verifyClient () {
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(true), 100);
    });
  }

  onJoin () {
    this.lock();
  }

}