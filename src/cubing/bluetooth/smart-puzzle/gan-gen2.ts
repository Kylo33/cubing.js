/* tslint:disable no-bitwise */

import { Move } from "../../alg";
import {
  type BluetoothConfig,
  BluetoothPuzzle,
} from "../../bluetooth/smart-puzzle/bluetooth-puzzle";
import { KPattern, type KPatternData, type KPuzzle } from "../../kpuzzle";
import { puzzles } from "../../puzzles";
import {
  importKey,
  unsafeDecryptBlockWithIV,
  unsafeEncryptBlockWithIV,
} from "../../vendor/public-domain/unsafe-raw-aes/unsafe-raw-aes";

const UUIDs = {
  primaryService: "6e400001-b5a3-f393-e0a9-e50e24dc4179",
  notifyCharacteristic: "28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4",
  readWriteCharacteristic: "28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4",
  descripterCharacteristic: "00002902-0000-1000-8000-00805F9B34FB",
} as const;

const Opcodes = {
  GYROSCOPE: 1,
  MOVE: 2,
  FACELETS: 4,
  HARDWARE: 5,
  BATTERY: 9,
  DISCONNECT: 13,
} as const;

type Opcode = (typeof Opcodes)[keyof typeof Opcodes];

const Commands = {
  REQUEST_FACELETS: new Uint8Array([Opcodes.FACELETS, ...Array(19).fill(0)]),
  REQUEST_HARDWARE: new Uint8Array([Opcodes.HARDWARE, ...Array(19).fill(0)]),
  REQUEST_BATTERY: new Uint8Array([Opcodes.BATTERY, ...Array(19).fill(0)]),
  REQUEST_RESET: new Uint8Array([
    0x0a,
    0x05,
    0x39,
    0x77,
    0x00,
    0x00,
    0x01,
    0x23,
    0x45,
    0x67,
    0x89,
    0xab,
    ...Array(8).fill(0),
  ]),
} as const;

type Command = keyof typeof Commands;

const opcodeResolves: Record<Command, Opcode | undefined> = {
  REQUEST_FACELETS: Opcodes.FACELETS,
  REQUEST_HARDWARE: Opcodes.HARDWARE,
  REQUEST_BATTERY: Opcodes.BATTERY,
  REQUEST_RESET: undefined,
};

const FACE_ORDER = "URFDLB";

/**
 * Decrypt a message from a second generation GAN smart cube.
 * @param message Cube-to-app message, to decrypt
 * @param key AES-CBC encryption key
 * @param iv AES-CBC initialization vector
 * @returns Message decrypted with the key and IV (AES-CBC)
 */
async function decryptMessage(
  message: Uint8Array | ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<Uint8Array<ArrayBufferLike>> {
  const res = new Uint8Array(message);

  if (res.length > 16) {
    res.set(
      new Uint8Array(
        await unsafeDecryptBlockWithIV(
          key,
          res.slice(res.length - 16, res.length),
          iv,
        ),
      ),
      res.length - 16,
    );
  }
  res.set(
    new Uint8Array(await unsafeDecryptBlockWithIV(key, res.slice(0, 16), iv)),
  );

  return res;
}

/**
 * Encrypt a message to send to a second generation GAN smart cube
 * @param message App-to-cube message to be encrypted
 * @param key AES-CBC encryption key
 * @param iv AES-CBC initialization vector
 * @returns Message encrypted with the key and IV (AES-CBC)
 */
async function encryptMessage(
  message: Uint8Array | ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<Uint8Array<ArrayBufferLike>> {
  const res = new Uint8Array(message);

  const encryptedBlock = await unsafeEncryptBlockWithIV(
    key,
    res.slice(0, 16),
    iv,
  );
  res.set(new Uint8Array(encryptedBlock, 0));

  if (res.length > 16) {
    const encryptedBlock = await unsafeEncryptBlockWithIV(
      key,
      res.slice(res.length - 16, res.length),
      iv,
    );

    res.set(new Uint8Array(encryptedBlock), res.length - 16);
  }

  return res;
}

/**
 * Creates {@link KPatternData} from Gan Gen2 Facelet data.
 * @param cp Gan Gen2 facelet corner permutation list (all 8 values; i.e. including the calculated value)
 * @param co Gan Gen2 facelet corner orientation list (all 8 values; i.e. including the calculated value)
 * @param ep Gan Gen2 facelet edge permutation list (all 12 values; i.e. including the calculated value)
 * @param eo Gan Gen2 facelet edge orientation list (all 12 values; i.e. including the calculated value)
 */
function patternDataFromGanFacelets(
  cp: number[],
  co: number[],
  ep: number[],
  eo: number[],
): KPatternData {
  const toGanCornerMap = [0, 3, 2, 1, 4, 5, 6, 7];
  const toGanEdgeMap = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10];

  const patternData: KPatternData = {
    CORNERS: {
      pieces: toGanCornerMap.map((ganIndex) => toGanCornerMap[cp[ganIndex]]),
      orientation: toGanCornerMap.map((ganIndex) => co[ganIndex]),
    },
    EDGES: {
      pieces: toGanEdgeMap.map((ganIndex) => toGanEdgeMap[ep[ganIndex]]),
      orientation: toGanEdgeMap.map((ganIndex) => eo[ganIndex]),
    },
    CENTERS: {
      pieces: [0, 1, 2, 3, 4, 5],
      orientation: [0, 0, 0, 0, 0, 0],
      orientationMod: [1, 1, 1, 1, 1, 1],
    },
  };

  return patternData;
}

/** A view of a message sent by a GAN Gen2 Smart Cube */
class GanMessageView {
  private dataView: DataView;
  private bitLength: number;

  public constructor(message: Uint8Array) {
    this.bitLength = message.byteLength * 8;
    this.dataView = new DataView(
      new Uint8Array([...message, ...new Array(4).fill(0)]).buffer,
    );
  }

  /**
   * Read a number of bits, as an unsigned integer.
   * @param start starting index
   * @param length number of bits to read
   * @returns unsigned integer representation of those bits
   */
  public readBits(start: number, length: number) {
    if (length < 1 || length > 16) {
      throw Error(`Length must be in the range [1, 16]: got ${length}`);
    }
    if (start + length > this.bitLength) {
      throw Error(
        `Tried to read past the end of the message: start + length = ${start + length}, bitLength = ${this.bitLength}`,
      );
    }
    const res = this.dataView.getUint16(Math.floor(start / 8));

    // Number of bits to remove from the left, due to starting at the nearest byte.
    const leftBitsToRemove = start - Math.floor(start / 8) * 8;

    const mask = (1 << length) - 1;
    return (res >>> (16 - length - leftBitsToRemove)) & mask;
  }

  public toString(): string {
    let s = "";
    for (let i = 0; i < this.bitLength / 8; i++) {
      s += this.dataView.getUint8(i).toString(2).padStart(8, "0");
    }
    return s;
  }
}

const SALT_LENGTH = 6;
const MAXIMUM_RESPONSE_WAIT_TIME = 5000;
class GanGen2Cube extends BluetoothPuzzle {
  private lastSerial: number = -1;
  private batteryLevel: number = 100;
  private pattern: KPattern;
  // TODO: Are these necessary?
  private _hardwareVersion: string | undefined;
  private _softwareVersion: string | undefined;
  private _hardwareName: string | undefined;
  private _initialPromise;
  private _resolvers: Map<Opcode, () => void> = new Map();

  public static async connect(
    server: BluetoothRemoteGATTServer,
  ): Promise<BluetoothPuzzle> {
    const aesKeyArr = new Uint8Array([
      0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07, 0x20, 0x05, 0x18, 0x54,
      0x42, 0x11, 0x12, 0x53,
    ]);
    const iv = new Uint8Array([
      0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27, 0x20, 0x95, 0x78, 0x14,
      0x32, 0x12, 0x02, 0x43,
    ]);

    // TODO: Automatically retrieve MAC address with .watchAdvertisements()
    const mac = "FE:97:F0:52:F5:F4";
    const salt = new Uint8Array(
      mac
        .split(":")
        .map((macSegment: string) => parseInt(macSegment, 16))
        .reverse(),
    );

    for (let i = 0; i < SALT_LENGTH; i++) {
      aesKeyArr[i] = (aesKeyArr[i] + salt[i]) % 0xff;
      iv[i] = (iv[i] + salt[i]) % 0xff;
    }

    const key = await importKey(aesKeyArr);
    const cube = new GanGen2Cube(
      await puzzles["3x3x3"].kpuzzle(),
      server,
      key,
      iv,
    );

    // Start notifications and request info
    // from the cube before returning the cube
    await cube.initialPromise;

    return cube;
  }

  public constructor(
    private kpuzzle: KPuzzle,
    private server: BluetoothRemoteGATTServer,
    private key: CryptoKey,
    private iv: Uint8Array,
  ) {
    super();
    this.pattern = kpuzzle.defaultPattern();
    this._initialPromise = this.startNotifications().then(
      this.requestCubeInfo.bind(this),
    );
  }

  public async startNotifications(): Promise<void> {
    const mainService = await this.server.getPrimaryService(
      UUIDs.primaryService,
    );
    const notifyCharacteristic = await mainService.getCharacteristic(
      UUIDs.notifyCharacteristic,
    );

    notifyCharacteristic.addEventListener(
      "characteristicvaluechanged",
      this.cubeMessageHandler.bind(this),
    );

    this.server.device.addEventListener(
      "gattserverdisconnected",
      this.disconnect.bind(this),
    );

    await notifyCharacteristic.startNotifications();
  }

  public async cubeMessageHandler(event: Event): Promise<void> {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    const message = await decryptMessage(
      new Uint8Array(characteristic.value!.buffer),
      this.key,
      this.iv,
    );

    const messageView = new GanMessageView(new Uint8Array(message.buffer));
    const opcode = messageView.readBits(0, 4) as Opcode;

    switch (opcode) {
      case Opcodes.GYROSCOPE:
        break;

      case Opcodes.MOVE: {
        const serial = messageView.readBits(4, 8);
        if (serial === -1) {
          break;
        }

        const newMoveCount = Math.min((serial - this.lastSerial) & 0xff, 7);

        this.lastSerial = serial;

        for (let i = newMoveCount - 1; i >= 0; i--) {
          const move = FACE_ORDER[messageView.readBits(12 + i * 5, 4)];
          const moveIsPrime = messageView.readBits(16 + i * 5, 1);

          const newMove = new Move(move, moveIsPrime ? -1 : 1);
          this.pattern = this.pattern.applyMove(newMove);
          this.dispatchAlgLeaf({
            latestAlgLeaf: newMove,
            timeStamp: Date.now(), // TODO: Find correct timestamp
          });
        }

        break;
      }

      case Opcodes.FACELETS: {
        const serial = messageView.readBits(4, 8);
        if (this.lastSerial === -1) {
          this.lastSerial = serial;
        }

        const ganCp = [];
        const ganCo = [];
        const ganEp = [];
        const ganEo = [];

        let cpSum = 0;
        let coSum = 0;

        for (let i = 0; i < 7; i++) {
          const cp = messageView.readBits(12 + i * 3, 3);
          const co = messageView.readBits(33 + i * 2, 2);

          cpSum += cp;
          coSum += co;

          ganCp.push(cp);
          ganCo.push(co);
        }

        ganCp.push(28 - cpSum);
        ganCo.push((3 - (coSum % 3)) % 3);

        let epSum = 0;
        let eoSum = 0;

        for (let i = 0; i < 11; i++) {
          const ep = messageView.readBits(47 + i * 4, 4);
          const eo = messageView.readBits(91 + i, 1);

          epSum += ep;
          eoSum += eo;

          ganEp.push(ep);
          ganEo.push(eo);
        }

        ganEp.push(66 - epSum);
        ganEo.push((2 - (eoSum % 2)) % 2);

        this.pattern = new KPattern(
          this.kpuzzle,
          patternDataFromGanFacelets(ganCp, ganCo, ganEp, ganEo),
        );

        break;
      }

      case Opcodes.HARDWARE: {
        const hwMajor = messageView.readBits(8, 8);
        const hwMinor = messageView.readBits(16, 8);
        const swMajor = messageView.readBits(24, 8);
        const swMinor = messageView.readBits(32, 8);

        let hwName = "";
        for (let i = 0; i < 8; i++) {
          hwName += String.fromCharCode(messageView.readBits(40 + i * 8, 8));
        }

        this._hardwareVersion = `${hwMajor}.${hwMinor}`;
        this._softwareVersion = `${swMajor}.${swMinor}`;
        this._hardwareName = hwName;

        break;
      }

      case Opcodes.BATTERY:
        this.batteryLevel = Math.min(messageView.readBits(8, 8), 100);
        break;

      case Opcodes.DISCONNECT:
        this.disconnect();
        break;
    }

    const resolver = this._resolvers.get(opcode) || (() => null);
    resolver();
    this._resolvers.delete(opcode);
  }

  public async requestCubeInfo(): Promise<void> {
    try {
      await this.sendCommand("REQUEST_FACELETS");
      await this.sendCommand("REQUEST_BATTERY");
      await this.sendCommand("REQUEST_HARDWARE");
    } catch (err) {
      throw Error(`Failed requests for cube info: ${err}`);
    }
  }

  private async sendCommand(
    command_type: keyof typeof Commands,
  ): Promise<Promise<void>> {
    const message = Commands[command_type];

    const readWriteCharacteristicPromise = this.server
      .getPrimaryService(UUIDs.primaryService)
      .then((primaryService) =>
        primaryService.getCharacteristic(UUIDs.readWriteCharacteristic),
      );
    const [encryptedMessage, readWriteCharacteristic] = await Promise.all([
      encryptMessage(message, this.key, this.iv),
      readWriteCharacteristicPromise,
    ]);

    await readWriteCharacteristic.writeValue(encryptedMessage);

    // If this command causes the cube to send a notification,
    // wait until the notification is processed before returning.
    const resolvingOpcode = opcodeResolves[command_type];
    if (resolvingOpcode !== undefined) {
      await new Promise((resolve, reject) => {
        this._resolvers.set(resolvingOpcode, () => resolve(undefined));
        setTimeout(
          () => reject(`Cube did not respond to command '${command_type}'`),
          MAXIMUM_RESPONSE_WAIT_TIME,
        );
      });
    }
  }

  public override async getPattern(): Promise<KPattern> {
    return this.pattern;
  }

  public override disconnect(): void {
    this.server.disconnect();
  }

  public override name(): string | undefined {
    return this.server.device.name;
  }

  public getBattery(): number {
    return this.batteryLevel;
  }

  get initialPromise(): Promise<void> {
    return this._initialPromise;
  }

  get softwareVersion(): string | undefined {
    return this._softwareVersion;
  }

  get hardwareVersion(): string | undefined {
    return this._hardwareVersion;
  }

  get hardwareName(): string | undefined {
    return this._hardwareName;
  }
}

export const ganGen2Config: BluetoothConfig<BluetoothPuzzle> = {
  connect: GanGen2Cube.connect.bind(GanGen2Cube),
  prefixes: ["GAN"],
  filters: [
    {
      namePrefix: "GAN",
    },
  ],
  optionalServices: [UUIDs.primaryService],
};
