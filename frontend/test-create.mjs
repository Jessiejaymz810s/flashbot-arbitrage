import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { create } from '@metaplex-foundation/mpl-candy-machine';
import { generateSigner, some, percentAmount } from '@metaplex-foundation/umi';

const umi = createUmi('https://api.devnet.solana.com');
const candyMachine = generateSigner(umi);
const creatorSigner = generateSigner(umi);

const res = create(umi, {
    candyMachine,
    collectionMint: candyMachine.publicKey,
    collectionUpdateAuthority: creatorSigner,
    tokenStandard: 0,
    sellerFeeBasisPoints: percentAmount(0),
    itemsAvailable: 5,
    creators: [],
    configLineSettings: some({
        prefixName: "Quazr Pass #",
        nameLength: 10,
        prefixUri: "https://example.com/metadata/",
        uriLength: 20,
        isSequential: false,
    }),
});
console.log(Object.keys(res));
