import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createSignerFromKeypair, signerIdentity, generateSigner, percentAmount, some } from '@metaplex-foundation/umi';
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { create, mplCandyMachine, addConfigLines } from '@metaplex-foundation/mpl-candy-machine';

async function main() {
    console.log("Initializing Umi on Devnet...");
    const umi = createUmi('https://api.devnet.solana.com')
        .use(mplTokenMetadata())
        .use(mplCandyMachine());

    // Generate a new keypair for the creator
    const creatorKeypair = umi.eddsa.generateKeypair();
    const creatorSigner = createSignerFromKeypair(umi, creatorKeypair);
    umi.use(signerIdentity(creatorSigner));
    console.log("Creator Address:", creatorSigner.publicKey.toString());

    // Airdrop SOL (on devnet)
    console.log("Airdropping 2 SOL to creator...");
    await umi.rpc.airdrop(creatorSigner.publicKey, { lamports: 2000000000n });
    console.log("Airdrop complete. Waiting 2 seconds...");
    await new Promise(r => setTimeout(r, 2000));

    // 1. Create a Collection NFT
    console.log("Creating Collection NFT...");
    const collectionMint = generateSigner(umi);
    await createNft(umi, {
        mint: collectionMint,
        name: "Quazr Genesis Pass",
        uri: "https://raw.githubusercontent.com/Jessiejaymz810s/flashbot-arbitrage/main/frontend/assets/nft/quazr_core.png",
        sellerFeeBasisPoints: percentAmount(0),
        isCollection: true,
    }).sendAndConfirm(umi);
    console.log("Collection NFT created:", collectionMint.publicKey.toString());

    // 2. Create Candy Machine
    console.log("Creating Candy Machine...");
    const candyMachine = generateSigner(umi);
    await create(umi, {
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
    }).sendAndConfirm(umi);
    console.log("Candy Machine created:", candyMachine.publicKey.toString());

    // 3. Add Items to Candy Machine
    console.log("Loading items into Candy Machine...");
    await addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [
            { name: "1", uri: "1.json" },
            { name: "2", uri: "2.json" },
            { name: "3", uri: "3.json" },
            { name: "4", uri: "4.json" },
            { name: "5", uri: "5.json" },
        ],
    }).sendAndConfirm(umi);

    console.log("✅ Candy Machine Setup Complete!");
    console.log("=========================================");
    console.log("CANDY_MACHINE_ID:", candyMachine.publicKey.toString());
    console.log("COLLECTION_MINT:", collectionMint.publicKey.toString());
    console.log("=========================================");
}

main().catch(console.error);
