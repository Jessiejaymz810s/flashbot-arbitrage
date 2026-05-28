import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { fetchCandyMachine, mintV2, mplCandyMachine } from '@metaplex-foundation/mpl-candy-machine';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { transactionBuilder, generateSigner, some } from '@metaplex-foundation/umi';

// Use a fallback Devnet Candy Machine ID if you have one, or a placeholder
const CANDY_MACHINE_ID = "27q6MzL3jQnRWdJfFqTU8SYoqk3oxKpSrzbQWViRkuo9";
const COLLECTION_MINT = "8bbsLXnB86yKa2HScBmE8zarbAMYhoqFKLnSUd1arxGk";

let umi = null;

export async function setupMinting(provider) {
    const mintBtn = document.getElementById('mint-btn');
    if (!mintBtn) return;

    if (!provider || !provider.isConnected) {
        mintBtn.textContent = "Connect Wallet to Mint";
        mintBtn.onclick = async () => {
            if (window.connectWallet) await window.connectWallet();
        };
        return;
    }

    mintBtn.textContent = "Loading Candy Machine...";
    mintBtn.disabled = true;

    try {
        umi = createUmi('https://api.devnet.solana.com')
            .use(mplCandyMachine())
            .use(walletAdapterIdentity(provider));

        // Attempt to fetch Candy Machine state (will throw if invalid ID)
        if (CANDY_MACHINE_ID !== "YourCandyMachineAddressHere") {
            const cm = await fetchCandyMachine(umi, CANDY_MACHINE_ID);
            
            const available = Number(cm.data.itemsAvailable) - Number(cm.itemsRedeemed);
            document.getElementById('mint-available').textContent = available;
            
            // Simplified pricing logic (assumes SOL payment guard)
            document.getElementById('mint-price').textContent = "0.25"; 

            mintBtn.textContent = available > 0 ? "MINT NOW" : "SOLD OUT";
            mintBtn.disabled = available <= 0;
            
            mintBtn.onclick = async () => {
                await handleMint(cm);
            };
        } else {
            // Placeholder state
            document.getElementById('mint-available').textContent = "5";
            document.getElementById('mint-price').textContent = "0.25";
            mintBtn.textContent = "MINT NOW (TEST)";
            mintBtn.disabled = false;
            mintBtn.onclick = async () => {
                window.showToast('⚠️ Please deploy a Candy Machine and update the ID in src/mint.js', 'error', 6000);
            };
        }
    } catch (err) {
        console.error("Failed to load Candy Machine:", err);
        mintBtn.textContent = "Error Loading CM";
        window.showToast("Failed to load Candy Machine data.", "error");
    }
}

async function handleMint(candyMachine) {
    const mintBtn = document.getElementById('mint-btn');
    mintBtn.disabled = true;
    mintBtn.textContent = "Minting...";
    window.showToast('⏳ Approving Mint Transaction...', 'pending', 60000);

    try {
        const nftMint = generateSigner(umi);
        const tx = transactionBuilder()
            .add(setComputeUnitLimit(umi, { units: 800_000 }))
            .add(
                mintV2(umi, {
                    candyMachine: candyMachine.publicKey,
                    nftMint,
                    collectionMint: COLLECTION_MINT,
                    collectionUpdateAuthority: candyMachine.authority,
                })
            );

        const { signature } = await tx.sendAndConfirm(umi, {
            confirm: { commitment: "confirmed" },
        });
        
        window.showToast(`🎉 Successfully Minted! <a href="https://solscan.io/tx/${signature}?cluster=devnet" target="_blank">View TX</a>`, 'success', 10000);
        mintBtn.textContent = "MINT NOW";
        mintBtn.disabled = false;
        
        // Update available count
        const current = parseInt(document.getElementById('mint-available').textContent);
        if(!isNaN(current)) document.getElementById('mint-available').textContent = current - 1;
        
    } catch (error) {
        console.error("Mint failed:", error);
        window.showToast('❌ Mint Failed: ' + (error.message || "Unknown Error"), 'error', 5000);
        mintBtn.textContent = "MINT NOW";
        mintBtn.disabled = false;
    }
}
