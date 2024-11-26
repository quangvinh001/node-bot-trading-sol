import { VersionedTransaction, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs/promises";

async function sendPortalLocalTransactionBundle() {
  try {
    // Đọc dữ liệu từ file params_action.txt
    const inputData = await fs.readFile("params_action.txt", "utf-8");
    const parsedData = JSON.parse(inputData);

    const transactionLogs = []; // Lưu trữ log giao dịch

    // Xử lý tất cả các giao dịch từ dữ liệu đầu vào
    await Promise.all(
      parsedData.map(async ({ privateKey, bundledTxArgs }, entryIndex) => {
        try {
          // Decode và kiểm tra khóa riêng
          let secretKey;
          try {
            secretKey = bs58.decode(privateKey);
            if (secretKey.length !== 64) {
              throw new Error("Độ dài private key không hợp lệ");
            }
          } catch (error) {
            throw new Error(`Lỗi giải mã private key: ${error.message}`);
          }

          // Tạo Keypair và PublicKey
          const signerKeyPair = Keypair.fromSecretKey(secretKey);
          const publicKey = signerKeyPair.publicKey.toBase58();

          // Thêm PublicKey vào đối số giao dịch
          const txArgsWithPublicKey = {
            publicKey: publicKey,
            ...bundledTxArgs,
          };

          // Gửi yêu cầu đến API để lấy thông tin giao dịch
          const response = await fetch("https://pumpportal.fun/api/trade-local", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([txArgsWithPublicKey]),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `Lỗi khi gọi API cho entry ${entryIndex + 1}: ${errorText}`
            );
          }

          const transactions = await response.json();

          // Kiểm tra định dạng phản hồi
          if (!Array.isArray(transactions)) {
            throw new Error(
              `Phản hồi không đúng định dạng cho ${publicKey}: ${JSON.stringify(
                transactions
              )}`
            );
          }

          // Xử lý từng giao dịch: Ký và chuẩn bị gửi qua Jito
          let encodedSignedTransactions = [];
          let signatures = [];
          for (let index = 0; index < transactions.length; index++) {
            const txData = transactions[index];
            const tx = VersionedTransaction.deserialize(
              new Uint8Array(bs58.decode(txData))
            );
            tx.sign([signerKeyPair]);
            const signature = bs58.encode(tx.signatures[0]);

            // Lưu giao dịch đã ký
            encodedSignedTransactions.push(bs58.encode(tx.serialize()));
            signatures.push(signature);

            // Thêm log giao dịch
            transactionLogs.push(
              `Entry ${entryIndex + 1}, Transaction ${index + 1}: https://solscan.io/tx/${signature}`
            );
          }

          // Gửi giao dịch qua Jito Block Engine
          try {
            const jitoResponse = await fetch(
              "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  id: 1,
                  method: "sendBundle",
                  params: [encodedSignedTransactions],
                }),
              }
            );

            if (!jitoResponse.ok) {
              const errorText = await jitoResponse.text();
              throw new Error(
                `Lỗi gửi bundle qua Jito cho entry ${entryIndex + 1}: ${errorText}`
              );
            }

            console.log(
              `Jito response for entry ${entryIndex + 1}:`,
              await jitoResponse.json()
            );
          } catch (jitoError) {
            console.error(`Lỗi Jito: ${jitoError.message}`);
          }
        } catch (error) {
          console.error(`Lỗi xử lý entry ${entryIndex + 1}: ${error.message}`);
        }
      })
    );

    // In log giao dịch
    console.log(transactionLogs.join("\n"));
  } catch (error) {
    console.error("Lỗi hệ thống:", error.message);
  }
}

sendPortalLocalTransactionBundle();
