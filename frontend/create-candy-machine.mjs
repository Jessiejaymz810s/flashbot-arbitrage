import fs from 'fs';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createSignerFromKeypair, signerIdentity, generateSigner, percentAmount, some, transactionBuilder } from '@metaplex-foundation/umi';
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { create, mplCandyMachine, addConfigLines } from '@metaplex-foundation/mpl-candy-machine';

const KEYPAIR_FILE = 'devnet-keypair.json';

async function main() {
    console.log("Initializing Umi on Devnet...");
    const umi = createUmi('https://api.devnet.solana.com')
        .use(mplTokenMetadata())
        .use(mplCandyMachine());

    let creatorKeypair;
    if (fs.existsSync(KEYPAIR_FILE)) {
        console.log("Found existing keypair file.");
        const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(KEYPAIR_FILE, 'utf-8')));
        creatorKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    } else {
        console.log("Generating a new keypair...");
        creatorKeypair = umi.eddsa.generateKeypair();
        fs.writeFileSync(KEYPAIR_FILE, JSON.stringify(Array.from(creatorKeypair.secretKey)));
        console.log(`Keypair saved to ${KEYPAIR_FILE}`);
    }

    const creatorSigner = createSignerFromKeypair(umi, creatorKeypair);
    umi.use(signerIdentity(creatorSigner));
    const address = creatorSigner.publicKey.toString();
    console.log("=========================================");
    console.log("Creator Address:", address);
    console.log("=========================================");

    // Check balance
    const balance = await umi.rpc.getBalance(creatorSigner.publicKey);
    console.log(`Current Balance: ${Number(balance.basisPoints) / 1e9} SOL`);

    if (Number(balance.basisPoints) < 500000000) { // Need at least 0.5 SOL
        console.log("\n❌ INSUFFICIENT FUNDS");
        console.log("The Solana Devnet automated airdrop is currently rate-limited.");
        console.log(`Please manually fund this address:`);
        console.log(`👉 ${address}`);
        console.log(`1. Go to https://faucet.solana.com`);
        console.log(`2. Paste your address and request Devnet SOL.`);
        console.log(`3. Run this script again once funded.\n`);
        return;
    }

    // 1. Create a Collection NFT
    console.log("\nCreating Collection NFT...");
    const collectionMint = generateSigner(umi);
    await createNft(umi, {
        mint: collectionMint,
        name: "Quazr Genesis Pass",
        uri: "https://raw.githubusercontent.com/Jessiejaymz810s/flashbot-arbitrage/main/frontend/assets/nft/quazr_core.png",
        sellerFeeBasisPoints: percentAmount(0),
        isCollection: true,
        tokenOwner: creatorSigner.publicKey,
    }).sendAndConfirm(umi, { confirm: { commitment: "finalized" } });
    console.log("Collection NFT created:", collectionMint.publicKey.toString());

    // 2. Create Candy Machine
    console.log("Creating Candy Machine...");
    const candyMachine = generateSigner(umi);
    const createTx = await create(umi, {
        candyMachine,
        collectionMint: collectionMint.publicKey,
        collectionUpdateAuthority: creatorSigner,
        tokenStandard: 0, // NonFungible
        sellerFeeBasisPoints: percentAmount(0),
        itemsAvailable: 5,
        creators: [
            {
                address: creatorSigner.publicKey,
                verified: true,
                percentageShare: 100,
            },
        ],
        configLineSettings: some({
            prefixName: "Quazr Pass #",
            nameLength: 10,
            prefixUri: "https://example.com/metadata/",
            uriLength: 20,
            isSequential: false,
        }),
    });
    
    await transactionBuilder()
        .add(createTx)
        .sendAndConfirm(umi, { confirm: { commitment: "finalized" } });
    console.log("Candy Machine created:", candyMachine.publicKey.toString());

    // 3. Add Items to Candy Machine
    console.log("Loading items into Candy Machine...");
    const addItemsTx = await addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [
            { name: "1", uri: "1.json" },
            { name: "2", uri: "2.json" },
            { name: "3", uri: "3.json" },
            { name: "4", uri: "4.json" },
            { name: "5", uri: "5.json" },
        ],
    });
    
    await transactionBuilder()
        .add(addItemsTx)
        .sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

    console.log("\n✅ Candy Machine Setup Complete!");
    console.log("=========================================");
    console.log("CANDY_MACHINE_ID:", candyMachine.publicKey.toString());
    console.log("COLLECTION_MINT:", collectionMint.publicKey.toString());
    console.log("=========================================\n");
}

main().catch(console.error);
