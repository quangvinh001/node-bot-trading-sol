import { VersionedTransaction, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs/promises";

async function sendPortalLocalTransactionBundle() {
  try {
    const inputData = await fs.readFile("params_action.txt", "utf-8");
    const parsedData = JSON.parse(inputData);

    const transactionLogs = []; // To store transaction details

    await Promise.all(
      parsedData.map(async ({ privateKey, bundledTxArgs }) => {
        try {
          // Decode private key and validate
          let secretKey;
          try {
            secretKey = bs58.decode(privateKey);
            if (secretKey.length !== 64) {
              throw new Error("Invalid private key length");
            }
          } catch (error) {
            throw new Error(`Failed to decode private key: ${error.message}`);
          }

          // Generate Keypair and PublicKey
          const signerKeyPair = Keypair.fromSecretKey(secretKey);
          const publicKey = signerKeyPair.publicKey.toBase58();

          // Add PublicKey to bundledTxArgs
          const txArgsWithPublicKey = {
            publicKey: publicKey,
            ...bundledTxArgs,
          };

          // Fetch transactions
          const response = await fetch(
            "https://pumpportal.fun/api/trade-local",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([txArgsWithPublicKey]),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `Error fetching transactions for ${publicKey}: ${response.statusText} - ${errorText}`
            );
          }

          const transactions = await response.json();

          if (!Array.isArray(transactions)) {
            throw new Error(
              `Unexpected transactions format for ${publicKey}: ${JSON.stringify(
                transactions
              )}`
            );
          }

          // Process transactions (sign and prepare logs)
          for (let index = 0; index < transactions.length; index++) {
            const txData = transactions[index];
            const tx = VersionedTransaction.deserialize(
              new Uint8Array(bs58.decode(txData))
            );
            tx.sign([signerKeyPair]);
            const signature = bs58.encode(tx.signatures[0]);

            // Log transaction details
            transactionLogs.push(
              `Transaction ${index + 1}: https://solscan.io/tx/${signature} | Amount: ${bundledTxArgs.amount} | Action: ${bundledTxArgs.action}`
            );
          }
        } catch (error) {
          console.error(`Error processing entry: ${error.message}`);
        }
      })
    );

    // Print transaction logs
    console.log(transactionLogs.join("\n"));
  } catch (error) {
    console.error("Critical error:", error.message);
  }
}

sendPortalLocalTransactionBundle();
