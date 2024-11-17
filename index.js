import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import * as web3 from '@solana/web3.js';
import bs58 from "bs58";
import fs from "fs/promises";
import { exec } from "child_process"; // For running bot.js


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 8080;

// Middleware để parse JSON trong body của các request POST
app.use(express.json());
// Kết nối tới RPC
const connection = new web3.Connection(
    "https://morning-bitter-violet.solana-mainnet.quiknode.pro/1af8324a8d48dfc7763570a0b6e54b1073905eb4/",
    "confirmed"
);

// Hàm lấy public key từ secret key
const getPublicKeyFromSecret = (secretKeyString) => {
    try {
        const secretKeyBytes = bs58.decode(secretKeyString);
        const keypair = web3.Keypair.fromSecretKey(secretKeyBytes);
        return keypair.publicKey;
    } catch (error) {
        throw new Error(`Invalid secret key: ${error.message}`);
    }
};

// Hàm lấy danh sách token cho một ví
async function getFixedTokenAccount(walletPublicKey, targetMint = null) {
    try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            walletPublicKey,
            {
                programId: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            }
        );

        // Lọc và format thông tin token
        const tokens = tokenAccounts.value
            .map(account => ({
                mint: account.account.data.parsed.info.mint,
                balance: account.account.data.parsed.info.tokenAmount.uiAmount
            }))
            .filter(token => token.balance > 0); // Chỉ lấy token có số dư > 0

        // Nếu có targetMint, chỉ trả về token đó
        if (targetMint) {
            return tokens.filter(token => token.mint === targetMint);
        }

        return tokens;
    } catch (error) {
        console.error(`Error getting tokens for ${walletPublicKey.toString()}:`, error);
        return [];
    }
}

app.post("/viewtoken", async (req, res) => {
    try {
        // Đọc mint address từ params_action.txt
        const actionData = JSON.parse(await fs.readFile('params_action.txt', 'utf8'));
        const mintAddress = actionData.mint;

        // Đọc secret keys từ params_key.txt
        const keysContent = await fs.readFile('params_key.txt', 'utf8');
        const secretKeys = keysContent
            .split('\n')
            .map(key => key.trim())
            .filter(key => key);

        // Lấy thông tin token cho từng ví
        const walletResults = [];

        for (const secretKey of secretKeys) {
            try {
                const publicKey = getPublicKeyFromSecret(secretKey);
                const tokens = await getFixedTokenAccount(publicKey, mintAddress);

                const walletInfo = {
                    address: publicKey.toString(),
                    tokens: tokens
                };

                walletResults.push(walletInfo);
            } catch (error) {
                console.error(`Error processing wallet:`, error);
                walletResults.push({
                    address: "error",
                    error: error.message
                });
            }
        }

        // Trả về kết quả theo format yêu cầu của frontend
        res.json({
            details: walletResults.map(wallet => ({
                address: wallet.address,
                tokens: wallet.tokens || [],
                error: wallet.error
            }))
        });

    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({
            error: "Có lỗi khi lấy dữ liệu token"
        });
    }
});

// Route để lưu token vào tệp `params.txt`
app.post('/savetoken', (req, res) => {
    const { token } = req.body;

    // Kiểm tra nếu token không hợp lệ
    if (!token) {
        return res.status(400).send('Token không hợp lệ');
    }

    // Chuẩn bị dữ liệu JSON để ghi vào file
    const data = {
        token: token
    };

    // Lưu token dưới dạng JSON vào file
    fs.writeFile('params.txt', JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error("Lỗi khi ghi file:", err);
            return res.status(500).send('Không thể lưu token vào file');
        }
        res.send('Token đã được lưu thành công dưới dạng JSON');
    });
});

// Route để phục vụ file index.html
app.get("/", async (req, res) => {
    try {
        const filePath = path.join(__dirname, "index.html");
        const data = await fs.readFile(filePath, "utf-8");
        res.status(200).send(data);
    } catch (err) {
        res.status(500).send("Lỗi khi phục vụ file index.html");
    }
});

app.get("/params_action", async (req, res) => {
    try {
        const data = await fs.readFile("params_action.txt", "utf-8");
        const transactions = JSON.parse(data);

        // Đảm bảo luôn trả về danh sách giao dịch (mảng)
        res.status(200).json(transactions);
    } catch (err) {
        console.error("Lỗi khi đọc params_action.txt:", err);
        res.status(500).json([]);
    }
});


app.get("/params_key", async (req, res) => {
    try {
        const data = await fs.readFile("params_key.txt", "utf-8");
        const keys = data.split("\n").map(line => line.trim()).filter(line => line);
        res.status(200).json(keys);
    } catch (err) {
        console.error("Lỗi khi đọc file params_key.txt:", err);
        res.status(500).send("Không thể đọc danh sách key.");
    }
});

app.get("/params", async (req, res) => {
    try {
        const data = await fs.readFile("params.txt", "utf-8");
        res.status(200).send(data);
    } catch (err) {
        res.status(500).send("");
    }
});

// Route POST để lưu private keys vào file params_key.txt
app.post("/nhapkey", async (req, res) => {
    try {
        const { privateKeys } = req.body;
        await fs.writeFile("params_key.txt", privateKeys.join("\n"));
        res.status(200).send("Private keys đã được lưu thành công");
    } catch (err) {
        res.status(500).send("Lỗi khi lưu private keys");
    }
});


app.post("/nhapthongso", async (req, res) => {
    try {
        const payload = req.body;

        if (!Array.isArray(payload) || payload.length === 0) {
            return res.status(400).send("Dữ liệu gửi lên không hợp lệ.");
        }

        const formattedData = payload.map(({ privateKey, bundledTxArgs }) => ({
            privateKey,
            bundledTxArgs,
        }));

        let existingData = [];
        try {
            // Đọc dữ liệu cũ từ file
            const fileContent = await fs.readFile("params_action.txt", "utf8");
            existingData = JSON.parse(fileContent); // Parse dữ liệu JSON từ file
        } catch (readErr) {
            if (readErr.code !== "ENOENT") {
                // Nếu lỗi không phải là "file không tồn tại", thì throw lỗi
                throw readErr;
            }
            // Nếu file không tồn tại, existingData sẽ là mảng rỗng
        }

        // Nối dữ liệu mới vào dữ liệu cũ
        const updatedData = [...existingData, ...formattedData];

        // Ghi dữ liệu xuống file
        await fs.writeFile("params_action.txt", JSON.stringify(updatedData, null, 2));

        res.status(200).send("Thông số giao dịch đã được lưu thành công.");
    } catch (err) {
        console.error("Lỗi khi lưu thông số giao dịch:", err);
        res.status(500).send("Không thể lưu thông số giao dịch.");
    }
});


async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

app.delete("/clear_params_action", async (req, res) => {
    try {
        const filePath = "params_action.txt";

        if (await fileExists(filePath)) {
            console.log(`File tồn tại: ${filePath}. Xóa nội dung.`);
            await fs.writeFile(filePath, "[]");
        } else {
            console.log(`File không tồn tại: ${filePath}. Tạo file mới.`);
            await fs.writeFile(filePath, "[]");
        }

        res.status(200).send("Tất cả thông số giao dịch đã được xóa.");
    } catch (err) {
        console.error("Lỗi khi xóa file params_action.txt:", err.message);
        res.status(500).send("Không thể xóa thông số giao dịch.");
    }
});



// Route xử lý POST /trade
app.post("/trade", (req, res) => {
    exec("node bot1.js", (error, stdout, stderr) => {
        if (error) {
            console.error("Lỗi khi thực hiện giao dịch:", stderr);
            res.status(500).send("Giao dịch thất bại");
            return;
        }
        res.status(200).send(stdout);
    });
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
