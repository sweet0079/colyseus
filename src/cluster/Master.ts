import * as cluster from "cluster";
import * as memshared from "memshared";
import * as child_process from "child_process";
import * as net from "net";
import * as ip from "ip";

import { Protocol } from "../Protocol";
import { spliceOne, registerGracefulShutdown, Deferred } from "../Utils";
import { debugCluster } from "../Debug";
import { Worker } from "cluster";

const seed = (Math.random() * 0xffffffff) | 0;
const workers: Worker[] = [];

// keep number of workers gracefully shut down
let workersShutDown = 0;
export const onWorkersShutdown = new Deferred();

export function getNextWorkerForSocket (socket: net.Socket) {
  let hash = getHash(ip.toBuffer(socket.remoteAddress || '127.0.0.1'));
  return workers[hash % workers.length];
}

// use the number of CPUs as number of workers.
export function spawnWorkers (numWorkers: number): Worker[] {
  let workers: Worker[] = [];

  for (var i = 0, len = numWorkers; i < len; i++) {
    workers.push(spawnWorker());
  }

  return workers;
}

export function spawnMatchMaking () {
  let worker = child_process.fork(__dirname + "/../matchmaking/Process", [], { silent: false });

  enableProcessCommunication(worker);

  // allow worker to use memshared
  memshared.registerProcess(worker);

  return worker;
}

function spawnWorker () {
  let worker = cluster.fork();

  debugCluster(`fork spawned with pid ${ worker.process.pid }`);

  if (!memshared.store['workerIds']) {
    memshared.store['workerIds'] = [];
  }

  // push worker id to shared workers list.
  memshared.store['workerIds'].push(worker.process.pid);

  // push worker to workers list
  workers.push(worker);

  enableProcessCommunication(worker);

  // auto-spawn a new worker on failure
  worker.on("exit", function (code, signal) {
    if (signal !== "SIGINT" && signal !== "SIGTERM" && signal !== "SIGUSR2") {
      console.warn("worker", process.pid, "died. Respawn.")

      // remove workerId from shared store
      spliceOne(memshared.store['workerIds'], memshared.store['workerIds'].indexOf(process.pid));

      // remove worker from workers list.
      spliceOne(workers, workers.indexOf(worker));

      // spawn new worker as a replacement for this one
      spawnWorker();

    } else {
      workersShutDown++;

      if (workersShutDown === workers.length) {
        onWorkersShutdown.resolve();
      }
    }
  });

  return worker;
}

function enableProcessCommunication(worker: child_process.ChildProcess | cluster.Worker) {
  worker.on("message", (message) => {
    let workerProcess = Array.isArray(message) && memshared.getProcessById(message.shift());
    if (workerProcess) {
      workerProcess.send(message);
    }
  });
}

/**
 */
function getHash (ip: Buffer) {
  let hash = seed;
  for (var i = 0; i < ip.length; i++) {
    var num = ip[i];

    hash += num;
    hash %= 2147483648;
    hash += (hash << 10);
    hash %= 2147483648;
    hash ^= hash >> 6;
  }

  hash += hash << 3;
  hash %= 2147483648;
  hash ^= hash >> 11;
  hash += hash << 15;
  hash %= 2147483648;

  return hash >>> 0;
}