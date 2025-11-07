import React, { useMemo, useState } from 'react';
import { BrowserProvider, Contract, ContractFactory, ethers } from 'ethers';
import SimpleNFTArtifact from '../artifacts/SimpleNFT.json';
import EscbaseTokenArtifact from '../artifacts/EscbaseToken.json';

type DeployedAddresses = { nft?: string; token?: string };
type LogItem = { type: 'info' | 'success' | 'error'; message: string; href?: string };

const ARC_CHAIN_ID_HEX = '0x4cef52'; // 5042002
const ARC_PARAMS = {
	chainId: ARC_CHAIN_ID_HEX,
	chainName: 'Arc Testnet',
	nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
	rpcUrls: ['https://rpc.testnet.arc.network'],
	blockExplorerUrls: ['https://testnet.arcscan.app']
};

export const App: React.FC = () => {
	const [provider, setProvider] = useState<BrowserProvider | null>(null);
	const [signerAddress, setSignerAddress] = useState<string>('');
	const [busy, setBusy] = useState<boolean>(false);
	const [deployed, setDeployed] = useState<DeployedAddresses>({});
	const [logs, setLogs] = useState<LogItem[]>([]);
	const [nativeBalance, setNativeBalance] = useState<string>('');
	const [sendRecipient, setSendRecipient] = useState<string>('');
	const [sendAmount, setSendAmount] = useState<string>('');
	const [swapAmount, setSwapAmount] = useState<string>('');

	const signerPromise = useMemo(async () => {
		if (!provider) return null;
		return provider.getSigner();
	}, [provider]);

	function pushLog(item: LogItem) {
		setLogs(prev => [item, ...prev]);
	}

	function addressLink(addr: string) {
		return `https://testnet.arcscan.app/address/${addr}`;
	}

	function txLink(hash: string) {
		return `https://testnet.arcscan.app/tx/${hash}`;
	}

function getErrorMessage(e: any): string {
	if (!e) return 'Unknown error';
	// MetaMask user rejection
	if (e.code === 4001 || e?.message?.includes('ACTION_REJECTED')) return 'User rejected in MetaMask';
	const msg = e.shortMessage || e.message || String(e);
	return msg.length > 180 ? msg.slice(0, 180) + '…' : msg;
}

	async function ensureArcNetwork(prov: BrowserProvider) {
		try {
			const current = await prov.send('eth_chainId', []);
			if (current?.toLowerCase?.() === ARC_CHAIN_ID_HEX) return true;
			try {
				await prov.send('wallet_switchEthereumChain', [{ chainId: ARC_CHAIN_ID_HEX }]);
				return true;
			} catch (err: any) {
				// 4902: Unrecognized chain → add first, then switch
				if (err && (err.code === 4902 || err?.message?.includes('Unrecognized chain'))) {
					await prov.send('wallet_addEthereumChain', [ARC_PARAMS]);
					await prov.send('wallet_switchEthereumChain', [{ chainId: ARC_CHAIN_ID_HEX }]);
					return true;
				}
				throw err;
			}
		} catch (e: any) {
			console.error(e);
			pushLog({ type: 'error', message: `Failed to switch to Arc Testnet: ${e?.message || 'unknown error'}` });
			return false;
		}
	}

	async function connect() {
		if (!window.ethereum) {
			alert('MetaMask not found. Please install it.');
			return;
		}
		const prov = new BrowserProvider(window.ethereum as any);
		await prov.send('eth_requestAccounts', []);
		const ok = await ensureArcNetwork(prov);
		if (!ok) return;
		const signer = await prov.getSigner();
		setProvider(prov);
		setSignerAddress(await signer.getAddress());
		try {
			const bal = await prov.getBalance(await signer.getAddress());
			setNativeBalance(ethers.formatUnits(bal, 18));
		} catch {}
		pushLog({ type: 'success', message: 'Wallet connected and on Arc Testnet.' });
	}

	async function deployNFT() {
		if (!provider) return;
		setBusy(true);
		try {
			const signer = await provider.getSigner();
			const factory = new ContractFactory(SimpleNFTArtifact.abi, SimpleNFTArtifact.bytecode, signer);
			const contract = await factory.deploy();
			const deployTx = contract.deploymentTransaction();
			await contract.waitForDeployment();
			const address = await contract.getAddress();
			setDeployed(prev => ({ ...prev, nft: address }));
			pushLog({ type: 'success', message: `Deployed SimpleNFT at ${address}`, href: addressLink(address) });
			if (deployTx?.hash) pushLog({ type: 'info', message: `Deployment tx`, href: txLink(deployTx.hash) });
		} catch (e: any) {
			pushLog({ type: 'error', message: getErrorMessage(e) });
		} finally {
			setBusy(false);
		}
	}

	async function deployToken() {
		if (!provider) return;
		setBusy(true);
		try {
			const signer = await provider.getSigner();
			const factory = new ContractFactory(EscbaseTokenArtifact.abi, EscbaseTokenArtifact.bytecode, signer);
			const contract = await factory.deploy();
			const deployTx = contract.deploymentTransaction();
			await contract.waitForDeployment();
			const address = await contract.getAddress();
			setDeployed(prev => ({ ...prev, token: address }));
			pushLog({ type: 'success', message: `Deployed EscbaseToken at ${address}`, href: addressLink(address) });
			if (deployTx?.hash) pushLog({ type: 'info', message: `Deployment tx`, href: txLink(deployTx.hash) });
		} catch (e: any) {
			pushLog({ type: 'error', message: getErrorMessage(e) });
		} finally {
			setBusy(false);
		}
	}

	async function mintNft() {
		if (!provider || !deployed.nft) return;
		setBusy(true);
		try {
			const signer = await provider.getSigner();
			const contract = new Contract(deployed.nft, SimpleNFTArtifact.abi, signer);
			const owner: string = await contract.owner();
			const tx = await contract.mint(owner);
			await tx.wait();
			pushLog({ type: 'success', message: `Minted NFT to owner`, href: txLink(tx.hash) });
		} catch (e: any) {
			pushLog({ type: 'error', message: getErrorMessage(e) });
		} finally {
			setBusy(false);
		}
	}

	async function mintToken() {
		if (!provider || !deployed.token) return;
		setBusy(true);
		try {
			const signer = await provider.getSigner();
			const contract = new Contract(deployed.token, EscbaseTokenArtifact.abi, signer);
			const owner: string = await contract.owner();
			const amount = ethers.parseUnits('100', 18); // default 100 tokens
			const tx = await contract.mint(owner, amount);
			await tx.wait();
			pushLog({ type: 'success', message: `Minted 100 ESC to owner`, href: txLink(tx.hash) });
		} catch (e: any) {
			pushLog({ type: 'error', message: getErrorMessage(e) });
		} finally {
			setBusy(false);
		}
	}

	async function sendUSDC() {
		if (!provider || !sendRecipient || !sendAmount) return;
		setBusy(true);
		try {
			const signer = await provider.getSigner();
			const amount = ethers.parseUnits(sendAmount, 18);
			const tx = await signer.sendTransaction({
				to: sendRecipient,
				value: amount
			});
			await tx.wait();
			pushLog({ type: 'success', message: `Sent ${sendAmount} USDC to ${sendRecipient.slice(0, 6)}…${sendRecipient.slice(-4)}`, href: txLink(tx.hash) });
			setSendRecipient('');
			setSendAmount('');
			// Refresh balance
			const bal = await provider.getBalance(await signer.getAddress());
			setNativeBalance(ethers.formatUnits(bal, 18));
		} catch (e: any) {
			pushLog({ type: 'error', message: getErrorMessage(e) });
		} finally {
			setBusy(false);
		}
	}

	async function swapUSDCtoESC() {
		if (!provider || !deployed.token || !swapAmount) return;
		setBusy(true);
		try {
			const signer = await provider.getSigner();
			const contract = new Contract(deployed.token, EscbaseTokenArtifact.abi, signer);
			const usdcAmount = ethers.parseUnits(swapAmount, 18);
			const tx = await contract.swap({ value: usdcAmount });
			await tx.wait();
			const escAmount = usdcAmount * BigInt(100000); // SWAP_RATE = 100000
			pushLog({ type: 'success', message: `Swapped ${swapAmount} USDC to ${ethers.formatUnits(escAmount, 18)} ESC`, href: txLink(tx.hash) });
			setSwapAmount('');
			// Refresh balance
			const bal = await provider.getBalance(await signer.getAddress());
			setNativeBalance(ethers.formatUnits(bal, 18));
		} catch (e: any) {
			pushLog({ type: 'error', message: getErrorMessage(e) });
		} finally {
			setBusy(false);
		}
	}

	return (
		<div style={{ width: '100%', maxWidth: 1240, margin: '0 auto', padding: '24px 20px', fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#E6EAF2', background: '#0B0F1A', minHeight: '100vh' }}>
			<h2 style={{ marginBottom: 6, color: '#E6EAF2' }}>ESC Arc Testnet DApp</h2>
			<p style={{ color: '#9AA4B2', marginTop: 0 }}>Arc Testnet • Explorer: <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" style={{ color: '#6EC2FB' }}>arcscan</a> • USDC Faucet: <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" style={{ color: '#6EC2FB' }}>faucet.circle.com</a></p>

			<div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
				<button onClick={connect} disabled={!!provider} style={{ padding: '10px 14px', borderRadius: 8, background: '#1F2A44', color: '#E6EAF2', border: '1px solid #2F3A5C' }}>Connect MetaMask</button>
				{provider && <button onClick={async () => provider && ensureArcNetwork(provider)} style={{ padding: '10px 14px', borderRadius: 8, background: '#1F2A44', color: '#E6EAF2', border: '1px solid #2F3A5C' }}>Switch to Arc</button>}
				{signerAddress && <span style={{ color: '#C6CFDC' }}>Connected: {signerAddress.slice(0, 6)}…{signerAddress.slice(-4)}</span>}
			</div>

			{provider && nativeBalance !== '' && Number(nativeBalance) === 0 && (
				<div style={{ border: '1px solid #3B476A', background: '#121826', padding: 12, borderRadius: 10, marginBottom: 16 }}>
					<span style={{ color: '#F2C94C' }}>Bạn chưa có test funds.</span> Lấy tại Faucet: <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" style={{ color: '#6EC2FB' }}>https://faucet.circle.com</a>
				</div>
			)}

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
				<div style={{ border: '1px solid #3B476A', padding: 16, borderRadius: 12, background: '#121826' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
						<h3 style={{ margin: 0, color: '#E6EAF2' }}>SimpleNFT</h3>
						{deployed.nft && <a href={addressLink(deployed.nft)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#6EC2FB' }}>View</a>}
					</div>
					<div style={{ display: 'flex', gap: 8 }}>
						<button onClick={deployNFT} disabled={!provider || busy} style={{ background: '#2C7BE5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8 }}>Deploy</button>
						<button onClick={mintNft} disabled={!provider || !deployed.nft || busy} style={{ background: '#6ECB5A', color: '#0B0F1A', border: 'none', padding: '8px 14px', borderRadius: 8 }}>Mint</button>
					</div>
				</div>
				<div style={{ border: '1px solid #3B476A', padding: 16, borderRadius: 12, background: '#121826' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
						<h3 style={{ margin: 0, color: '#E6EAF2' }}>EscbaseToken</h3>
						{deployed.token && <a href={addressLink(deployed.token)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#6EC2FB' }}>View</a>}
					</div>
					<div style={{ display: 'flex', gap: 8 }}>
						<button onClick={deployToken} disabled={!provider || busy} style={{ background: '#2C7BE5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8 }}>Deploy</button>
						<button onClick={mintToken} disabled={!provider || !deployed.token || busy} style={{ background: '#6ECB5A', color: '#0B0F1A', border: 'none', padding: '8px 14px', borderRadius: 8 }}>Mint</button>
					</div>
				</div>
				<div style={{ border: '1px solid #3B476A', padding: 16, borderRadius: 12, background: '#121826' }}>
					<h3 style={{ margin: '0 0 12px 0', color: '#E6EAF2' }}>Send USDC</h3>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<input
								type="text"
								placeholder="Recipient address (0x...)"
								value={sendRecipient}
								onChange={(e) => setSendRecipient(e.target.value)}
								disabled={!provider || busy}
								style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#1F2A44', border: '1px solid #2F3A5C', color: '#E6EAF2' }}
							/>
							<button
								onClick={() => signerAddress && setSendRecipient(signerAddress)}
								disabled={!provider || busy}
								style={{ padding: '8px 12px', borderRadius: 8, background: '#2C7BE5', color: '#fff', border: 'none', fontSize: 12 }}
							>
								Myself
							</button>
						</div>
						<input
							type="text"
							placeholder="Amount (USDC)"
							value={sendAmount}
							onChange={(e) => setSendAmount(e.target.value)}
							disabled={!provider || busy}
							style={{ padding: '8px 12px', borderRadius: 8, background: '#1F2A44', border: '1px solid #2F3A5C', color: '#E6EAF2' }}
						/>
						<button
							onClick={sendUSDC}
							disabled={!provider || !sendRecipient || !sendAmount || busy}
							style={{ background: '#2C7BE5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8 }}
						>
							Send
						</button>
					</div>
				</div>
				<div style={{ border: '1px solid #3B476A', padding: 16, borderRadius: 12, background: '#121826' }}>
					<h3 style={{ margin: '0 0 12px 0', color: '#E6EAF2' }}>Swap USDC to ESC</h3>
					<div style={{ marginBottom: 8, color: '#9AA4B2', fontSize: 14 }}>Rate: 0.0001 USDC = 10 ESC</div>
					{!deployed.token && (
						<div style={{ border: '1px solid #FF6B6B', background: '#2A1F1F', padding: 10, borderRadius: 8, marginBottom: 12 }}>
							<span style={{ color: '#FF6B6B' }}>Phải tạo EscbaseToken contract trước</span>
						</div>
					)}
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<input
							type="text"
							placeholder="Amount (USDC)"
							value={swapAmount}
							onChange={(e) => setSwapAmount(e.target.value)}
							disabled={!provider || !deployed.token || busy}
							style={{ padding: '8px 12px', borderRadius: 8, background: '#1F2A44', border: '1px solid #2F3A5C', color: '#E6EAF2' }}
						/>
						<button
							onClick={swapUSDCtoESC}
							disabled={!provider || !deployed.token || !swapAmount || busy}
							style={{ background: '#1F2A44', color: '#E6EAF2', border: '1px solid #2F3A5C', padding: '8px 14px', borderRadius: 8 }}
						>
							Swap
						</button>
					</div>
				</div>
			</div>

			<div style={{ marginTop: 20 }}>
				<h4 style={{ margin: '12px 0', color: '#C6CFDC' }}>Activity</h4>
				<div style={{ border: '1px solid #3B476A', borderRadius: 8, padding: 12, background: '#0F1524' }}>
					{logs.length === 0 ? (
						<p style={{ color: '#9AA4B2', margin: 0 }}>No activity yet.</p>
					) : (
						<ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
							{logs.map((l, i) => (
								<li key={i} style={{ color: l.type === 'error' ? '#FF6B6B' : l.type === 'success' ? '#6ECB5A' : '#E6EAF2' }}>
									{l.href ? <a href={l.href} target="_blank" rel="noreferrer" style={{ color: '#6EC2FB' }}>{l.message}</a> : l.message}
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
};

declare global {
	interface Window { ethereum?: unknown }
}


