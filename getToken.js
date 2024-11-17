import web3 from "@solana/web3.js";

(async () => {
  try {
    // Kết nối tới RPC của QuickNode
    const connection = new web3.Connection(
      "https://morning-bitter-violet.solana-mainnet.quiknode.pro/1af8324a8d48dfc7763570a0b6e54b1073905eb4/",
      "confirmed"
    );

    // Danh sách các địa chỉ ví cần kiểm tra
    const walletAddresses = [
      "HhqMGHG1irpybeLZv4fdZRMcWmx9JTm14KqUE5Lmd2p5",
      "326Q4jB25QtUwMjhyotuRLnZvgwMZ3DwLiRo3GcEYRZ9",
      "FZvbtK5xwggs4zsPudzyHPwc3rLCB9PET6UVPjUM3txb", // Thêm nhiều địa chỉ ví tại đây
    ];

    // Địa chỉ mint của token cố định (Ví dụ: USDT)
    const fixedMintAddress = new web3.PublicKey("FkjbKgPHykx7F45CJxvov61DEppNgh4kR8sBL4LKpump");

    // Hàm lấy token cố định cho từng ví
    const getFixedTokenAccount = async (walletAddress) => {
      const publicKey = new web3.PublicKey(walletAddress);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // Token Program ID
      });

      // Lọc token cố định theo mint address
      const fixedToken = tokenAccounts.value.filter(account => {
        return account.account.data.parsed.info.mint === fixedMintAddress.toString();
      });

      return fixedToken.map(account => {
        const tokenInfo = account.account.data.parsed.info;
        return {
          mint: tokenInfo.mint,
          balance: tokenInfo.tokenAmount.uiAmount,
        };
      });
    };

    // Lặp qua danh sách các địa chỉ ví và lấy token cố định
    for (const wallet of walletAddresses) {
      console.log(`\n📘 Token cố định của ví: ${wallet}`);
      const tokens = await getFixedTokenAccount(wallet);
      if (tokens.length > 0) {
        tokens.forEach((token, index) => {
          console.log(`${index + 1}. Mint: ${token.mint}`);
          console.log(`   Số dư: ${token.balance}`);
        });
      } else {
        console.log("   ❌ Ví không chứa token cố định.");
      }
    }
  } catch (error) {
    console.error("Lỗi khi gọi API:", error.message);
  }
})();
