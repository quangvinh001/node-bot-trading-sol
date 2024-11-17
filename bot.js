import { VersionedTransaction, Connection, Keypair, sendAndConfirmTransaction} from '@solana/web3.js';
import bs58 from "bs58";

async function sendTransactionBundle(){
    const signerKeyPairs = [
        Keypair.fromSecretKey(bs58.decode("3ddkhVugzJe3CjQUsGM1LNaHLKxjecat6EgenGPdKsDhzumcP89P2k312Ct4JBaeRtopgw8V9Ayj3BvjGFbx93iD")),
    ];
    const bundledTxArgs = [
        {
            publicKey: signerKeyPairs[0].publicKey.toBase58(),
            "action": "buy", // "buy", "sell", or "create"
            "mint": "FkjbKgPHykx7F45CJxvov61DEppNgh4kR8sBL4LKpump", 
            "denominatedInSol": "true",  
            "amount": 0.001, 
            "slippage": 1, 
            "priorityFee": 0.00005, //priority fee on the first tx is used for jito tip
            "pool": "pump"
        }
    ];
    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(bundledTxArgs)
    });
    if(response.status === 200){ // successfully generated transaction
        const transactions = await response.json();
        console.log(transactions);
        let encodedSignedTransactions = [];
        let signatures = [];
        for(let i = 0; i < bundledTxArgs.length; i++){ //decode and sign each tx
            const tx = VersionedTransaction.deserialize(new Uint8Array(bs58.decode(transactions[i])));
            tx.sign([signerKeyPairs[i]]);
            encodedSignedTransactions.push(bs58.encode(tx.serialize()));
            signatures.push(bs58.encode(tx.signatures[0]));
        }
        
        try{
            const jitoResponse = await fetch(`https://mainnet.block-engine.jito.wtf/api/v1/bundles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "sendBundle",
                    "params": [
                    encodedSignedTransactions
                    ]
                })
            });
            console.log(jitoResponse);
        } catch(e){
            console.error(e.message);
        }
        for(let i = 0; i < signatures.length; i++){
            console.log(`Transaction ${i}: https://solscan.io/tx/${signatures[i]}`);
        }
    } else {
        console.log(response.statusText); // log error
    }
}
sendTransactionBundle();