/* tslint:disable no-bitwise */

import {
  type BluetoothConfig,
  BluetoothPuzzle,
} from "../../bluetooth/smart-puzzle/bluetooth-puzzle";
import type { KPuzzle } from "../../kpuzzle";
import { puzzles } from "../../puzzles";
import {
  importKey,
  unsafeDecryptBlockWithIV,
} from "../../vendor/public-domain/unsafe-raw-aes/unsafe-raw-aes";

const UUIDs = Object.freeze({
  primaryService: "6e400001-b5a3-f393-e0a9-e50e24dc4179",
  notifyCharacteristic: "28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4",
  readWriteCharacteristic: "28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4",
  descripterCharacteristic: "00002902-0000-1000-8000-00805F9B34FB",
});

const Opcodes = Object.freeze({
  GYROSCOPE: 1,
  MOVE: 2,
  FACELETS: 4,
  HARDWARE: 5,
  BATTERY: 9,
  DISCONNECT: 13,
});

/**
 * Decrypt a message from a second generation GAN smart cube.
 * @param message Cube-to-app message, to decrypt
 * @param key AES-CBC encryption key
 * @param iv AES-CBC initialization vector
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

const SALT_LENGTH = 6;
class GanGen2Cube extends BluetoothPuzzle {
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

    const aesKey = await importKey(aesKeyArr);
    return new GanGen2Cube(
      await puzzles["3x3x3"].kpuzzle(),
      server,
      aesKey,
      iv,
    );
  }

  public constructor(
    private kpuzzle: KPuzzle,
    private server: BluetoothRemoteGATTServer,
    private aesKey: CryptoKey,
    private iv: Uint8Array,
  ) {
    super();
    this.startNotifications();
    this.server.device.addEventListener(
      "gattserverdisconnected",
      this.disconnect.bind(this),
    );
  }

  public async startNotifications() {
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

    notifyCharacteristic.startNotifications();
  }

  public async cubeMessageHandler(event: Event) {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    const message = await decryptMessage(
      new Uint8Array(characteristic.value!.buffer),
      this.aesKey,
      this.iv,
    );

    // This cube uses big-endian.
    const messageView = new DataView(message.buffer);
    const opcode = messageView.getUint8(0) >> 4;

    switch (opcode) {
      case Opcodes.GYROSCOPE:
        console.log("Received gyroscope notification");
        break;

      case Opcodes.MOVE:
        console.log("Received cube move notification");
        break;

      case Opcodes.FACELETS:
        console.log("Received cube facelets notification");
        break;

      case Opcodes.HARDWARE:
        console.log("Received cube hardware notification");
        break;

      case Opcodes.BATTERY:
        console.log("Received cube battery notification");
        break;

      case Opcodes.DISCONNECT:
        console.log("Received cube disconnect notification");
        break;

      default:
        throw Error("Received non-implemented opcode");
    }
  }

  public override disconnect(): void {
    this.server.disconnect();
  }

  public override name(): string | undefined {
    return this.server.device.name;
  }
}

export const ganGen2Config: BluetoothConfig<BluetoothPuzzle> = {
  connect: GanGen2Cube.connect.bind(GanGen2Cube),
  prefixes: ["GAN"],
  filters: [
    {
      namePrefix: "GAN",
      services: [UUIDs.primaryService],
    },
  ],
  optionalServices: [UUIDs.primaryService],
};
