import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { setupMinting } from './mint.js';

// ═══ CONFIG ═══
const RECEIVE_WALLET = 'ExnLqmHs1zMe4CbFtoygooiVSBomH2hwALWefeWQ1GHY';
const PRICE_SOL = 0.25;
const LAMPORTS = PRICE_SOL * 1e9;
const RPC_URL = 'https://api.mainnet-beta.solana.com';

const NFT_DATA = [
    {
        id: 'galactic_cat',
        name: 'Galactic Cat',
        desc: 'A majestic Galactic Cat from the Quazr ecosystem. Fur made of nebulae and eyes like glowing stars.',
        image: 'assets/nft/galactic_cat.png',
        rarity: 'Epic',
        rarityClass: 'epic',
        cardClass: 'rarity-epic',
        traits: [{ type: 'Type', value: 'Feline' }, { type: 'Power', value: 'Cosmic' }],
        price: PRICE_SOL
    },
    {
        id: 'quazr_core',
        name: 'Quazr Core',
        desc: 'The hyper-realistic, glowing quasar at the center of the Quazr universe. Emitting pure cosmic energy.',
        image: 'assets/nft/quazr_core.png',
        rarity: 'Legendary',
        rarityClass: 'legendary',
        cardClass: 'rarity-legendary',
        traits: [{ type: 'Type', value: 'Celestial' }, { type: 'Energy', value: 'Infinite' }],
        price: PRICE_SOL
    },
    {
        id: 'shiba_astronaut',
        name: 'Shiba Astronaut',
        desc: 'The iconic Shiba Astronaut exploring deep space with Quazr technology. To the moon and beyond!',
        image: 'assets/nft/shiba_astronaut.png',
        rarity: 'Rare',
        rarityClass: 'rare',
        cardClass: 'rarity-rare',
        traits: [{ type: 'Type', value: 'Canine' }, { type: 'Suit', value: 'Cosmic Gold' }],
        price: PRICE_SOL
    }
];

// ═══ STATE ═══
let connectedWallet = null;
let currentModalNft = null;

// ═══ PROVIDER DETECTION ═══
function getProvider() {
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solana?.isPhantom) return window.solana;
    return null;
}

function waitForProvider(timeout = 3000) {
    return new Promise((resolve) => {
        const provider = getProvider();
        if (provider) return resolve(provider);
        const start = Date.now();
        const interval = setInterval(() => {
            const p = getProvider();
            if (p || Date.now() - start > timeout) {
                clearInterval(interval);
                resolve(p || null);
            }
        }, 100);
    });
}

function getSoldItems() {
    try { return JSON.parse(localStorage.getItem('qz_sold') || '[]'); }
    catch { return []; }
}
function markSold(id) {
    const sold = getSoldItems();
    if (!sold.includes(id)) { sold.push(id); localStorage.setItem('qz_sold', JSON.stringify(sold)); }
}

// ═══ RENDER CARDS ═══
function renderCards() {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    const sold = getSoldItems();
    let available = 0;
    grid.innerHTML = NFT_DATA.map(nft => {
        const isSold = sold.includes(nft.id);
        if (!isSold) available++;
        return `
        <div class="market-card ${nft.cardClass}" data-id="${nft.id}">
            ${isSold ? '<div class="sold-overlay"><div class="sold-badge">SOLD</div></div>' : ''}
            <span class="edition-badge">1 of 1</span>
            <div class="card-image" onclick="window.openModal('${nft.id}')">
                <img src="${nft.image}" alt="${nft.name}" loading="lazy">
                <div class="view-overlay"><span>View Details</span></div>
            </div>
            <div class="card-top-row">
                <h4>${nft.name}</h4>
                <span class="rarity ${nft.rarityClass}">${nft.rarity}</span>
            </div>
            <p class="card-desc">${nft.desc}</p>
            <div class="card-traits">
                ${nft.traits.map(t => `<span class="trait-chip">${t.type}: ${t.value}</span>`).join('')}
            </div>
            <div class="card-bottom">
                <div class="price-block">
                    <span class="price-label">Price</span>
                    <span class="price-value">
                        <img src="https://cryptologos.cc/logos/solana-sol-logo.svg?v=024" class="sol-icon" alt="SOL">
                        ${nft.price} SOL
                    </span>
                </div>
                <button class="btn-buy ${isSold ? 'sold' : ''}" 
                        ${isSold ? 'disabled' : ''}
                        onclick="window.buyNft('${nft.id}', this)">
                    ${isSold ? 'SOLD' : 'Buy Now'}
                </button>
            </div>
        </div>`;
    }).join('');
    const itemsRemaining = document.getElementById('items-remaining');
    if (itemsRemaining) itemsRemaining.textContent = available;
}

// ═══ WALLET ═══
window.connectWallet = async function() {
    const btn = document.getElementById('wallet-btn');
    if (connectedWallet) {
        const provider = getProvider();
        if (provider) provider.disconnect();
        connectedWallet = null;
        btn.classList.remove('connected');
        btn.innerHTML = '🔗 Connect Wallet';
        return;
    }

    window.showToast('⏳ Looking for Phantom...', 'pending', 2000);
    const provider = await waitForProvider();

    if (!provider) {
        if (window.location.protocol === 'file:') {
            window.showToast('⚠️ Phantom cannot connect on file:// pages.', 'error', 6000);
        } else {
            window.open('https://phantom.app/', '_blank');
            window.showToast('Please install Phantom Wallet to buy NFTs', 'error');
        }
        return;
    }
    try {
        const resp = await provider.connect();
        connectedWallet = resp.publicKey.toString();
        const short = connectedWallet.slice(0, 4) + '...' + connectedWallet.slice(-4);
        btn.classList.add('connected');
        btn.innerHTML = '<span class="wallet-dot"></span> ' + short;
        window.showToast('✅ Wallet connected!', 'success');
    } catch (err) {
        if (err.code === 4001 || err.message?.includes('User rejected')) {
            window.showToast('Connection cancelled by user', 'error');
        } else {
            window.showToast('Connection failed: ' + (err.message || err), 'error');
        }
    }
}

// ═══ PURCHASE ═══
window.buyNft = async function(id, btnEl) {
    if (getSoldItems().includes(id)) return;
    if (!connectedWallet) {
        await window.connectWallet();
        if (!connectedWallet) return;
    }
    const nft = NFT_DATA.find(n => n.id === id);
    if (!nft) return;

    btnEl.classList.add('loading');
    btnEl.disabled = true;
    window.showToast('⏳ Preparing transaction...', 'pending');

    try {
        const connection = new Connection(RPC_URL, 'confirmed');
        const fromPubkey = new PublicKey(connectedWallet);
        const toPubkey = new PublicKey(RECEIVE_WALLET);

        const tx = new Transaction().add(
            SystemProgram.transfer({ fromPubkey, toPubkey, lamports: LAMPORTS })
        );
        tx.feePayer = fromPubkey;
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        const provider = getProvider();
        const signed = await provider.signTransaction(tx);
        window.showToast('⏳ Confirming on Solana...', 'pending');
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(sig, 'confirmed');

        markSold(id);
        renderCards();
        window.showToast(`✅ Purchase complete! <a href="https://solscan.io/tx/${sig}" target="_blank">View TX</a>`, 'success', 8000);
    } catch (err) {
        console.error(err);
        const msg = err.message?.includes('User rejected') ? 'Transaction cancelled' : 'Transaction failed: ' + (err.message || err);
        window.showToast('❌ ' + msg, 'error');
    } finally {
        btnEl.classList.remove('loading');
        if (!getSoldItems().includes(id)) { btnEl.disabled = false; }
    }
}

// ═══ MODAL ═══
window.openModal = function(id) {
    const nft = NFT_DATA.find(n => n.id === id);
    if (!nft) return;
    currentModalNft = nft;
    document.getElementById('modal-img').src = nft.image;
    document.getElementById('modal-name').textContent = nft.name;
    document.getElementById('modal-desc').textContent = nft.desc;
    document.getElementById('modal-price').textContent = nft.price;
    const rarityEl = document.getElementById('modal-rarity');
    rarityEl.textContent = nft.rarity;
    rarityEl.className = 'rarity ' + nft.rarityClass;
    document.getElementById('modal-traits').innerHTML = nft.traits.map(t => `<span class="trait-chip">${t.type}: ${t.value}</span>`).join('');
    const isSold = getSoldItems().includes(id);
    const buyBtn = document.getElementById('modal-buy-btn');
    buyBtn.textContent = isSold ? 'SOLD' : 'Buy Now';
    buyBtn.className = 'btn-buy' + (isSold ? ' sold' : '');
    buyBtn.disabled = isSold;
    document.getElementById('nft-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

window.closeModal = function() {
    document.getElementById('nft-modal').classList.remove('active');
    document.body.style.overflow = '';
    currentModalNft = null;
}

window.buyFromModal = function() {
    if (!currentModalNft) return;
    window.closeModal();
    const card = document.querySelector(`.market-card[data-id="${currentModalNft.id}"] .btn-buy`);
    if (card) window.buyNft(currentModalNft.id, card);
}

// ═══ TOAST & UTILS ═══
window.showToast = function(msg, type = 'success', duration = 4000) {
    const toast = document.getElementById('tx-toast');
    if (!toast) return;
    toast.innerHTML = msg;
    toast.className = 'tx-toast ' + type + ' show';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.classList.remove('show'); }, duration);
}

window.copyCA = function() {
    navigator.clipboard.writeText(document.getElementById('ca').innerText);
    window.showToast('📋 Contract address copied!', 'success', 2000);
}

window.copySolAddress = function() {
    navigator.clipboard.writeText(document.getElementById('sol-address').innerText);
    window.showToast('📋 Solana address copied!', 'success', 2000);
}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', async () => {
    renderCards();
    
    document.getElementById('nft-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('nft-modal')) window.closeModal();
    });
    
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.closeModal(); });

    // Auto-connect / detect provider
    const provider = await waitForProvider(2000);
    if (provider) {
        provider.on('connect', () => {
            connectedWallet = provider.publicKey.toString();
            const short = connectedWallet.slice(0, 4) + '...' + connectedWallet.slice(-4);
            const btn = document.getElementById('wallet-btn');
            if(btn) {
                btn.classList.add('connected');
                btn.innerHTML = '<span class="wallet-dot"></span> ' + short;
            }
            setupMinting(provider);
        });
        provider.on('disconnect', () => {
            connectedWallet = null;
            const btn = document.getElementById('wallet-btn');
            if(btn) {
                btn.classList.remove('connected');
                btn.innerHTML = '🔗 Connect Wallet';
            }
            setupMinting(null);
        });
        if (provider.isConnected && provider.publicKey) {
            connectedWallet = provider.publicKey.toString();
            const short = connectedWallet.slice(0, 4) + '...' + connectedWallet.slice(-4);
            const btn = document.getElementById('wallet-btn');
            if(btn) {
                btn.classList.add('connected');
                btn.innerHTML = '<span class="wallet-dot"></span> ' + short;
            }
            setupMinting(provider);
        } else {
            setupMinting(null);
        }
    } else {
        setupMinting(null);
    }
});
