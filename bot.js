import { VersionedTransaction, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs/promises";

async function sendPortalLocalTransactionBundle() {
  const keyFileContent = await fs.readFile("params_key.txt", "utf-8");
  const privateKeys = keyFileContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  let fixedParams;
  try {
    const paramsFileContent = await fs.readFile("params_action.txt", "utf-8");
    fixedParams = JSON.parse(paramsFileContent);
  } catch (e) {
    console.error("Lỗi đọc tham số cố định:", e.message);
    return;
  }

  for (const privateKey of privateKeys) {
    let signerKeyPair;
    try {
      signerKeyPair = Keypair.fromSecretKey(bs58.decode(privateKey));
    } catch (e) {
      console.error(`Private key không hợp lệ: ${privateKey}`);
      continue;
    }

    const bundledTxArgs = [
      {
        publicKey: signerKeyPair.publicKey.toBase58(),
        ...fixedParams,
      },
    ];

    const response = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bundledTxArgs),
    });

    if (response.status === 200) {
      const transactions = await response.json();
      let encodedSignedTransactions = [];
      let signatures = [];

      for (let j = 0; j < transactions.length; j++) {
        const tx = VersionedTransaction.deserialize(
          new Uint8Array(bs58.decode(transactions[j]))
        );
        tx.sign([signerKeyPair]);
        encodedSignedTransactions.push(bs58.encode(tx.serialize()));
        signatures.push(bs58.encode(tx.signatures[0]));
      }

      try {
        const jitoResponse = await fetch(
          "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "sendBundle",
              params: [encodedSignedTransactions],
            }),
          }
        );
        console.log(
          "Giao dịch thành công cho private key:",
          signerKeyPair.publicKey.toBase58()
        );
      } catch (e) {
        console.error("Lỗi khi gửi giao dịch:", e.message);
      }

      for (let k = 0; k < signatures.length; k++) {
        console.log(`Transaction ${k}: https://solscan.io/tx/${signatures[k]}`);
      }
    } else {
      console.log(
        `Lỗi khi lấy giao dịch cho private key ${signerKeyPair.publicKey.toBase58()}: ${response.statusText}`
      );
    }
  }
}

sendPortalLocalTransactionBundle();
