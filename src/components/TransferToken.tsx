import { FC, Suspense, useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey } from '@solana/web3.js';
import { AccountLayout, TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { notify } from 'utils/notifications';
import { Metadata, PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import dynamic from 'next/dynamic';

const buttonStatus = {
    connected: "Transfer",
    nonConnected: "Please Connect Wallet!"
}

export const TransferToken = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const [allTokenList, setAllTokenList] = useState<any>(null);
    const [destinationAddress, setDestinationAddress] = useState("");
    const [transferAmount, setTransferAmount] = useState<number>(0);
    const [isConnected, setIsConnected] = useState(false);
    const [selectedTokenData, setSelectedTokenData] = useState<number>(null);
    const [fromTokenData, setFromTokenData] = useState<{ source: PublicKey, mint: PublicKey, amount: any } | null>(null);
    const [tokenMetadataList, setTokenMetadataList] = useState<any[]>([]);
    const [logoList, setLogoList] = useState<string[]>([]);
    const [tokenBalance, setTokenBalance] = useState<any[]>([]);

    useEffect(() => {
        const getAllTokenList = async () => {
            if (!publicKey) {
                notify({ type: 'error', message: `Please connect Wallet` });
                return;
            } else {
                setIsConnected(true);
                const tokenAccounts = await connection.getTokenAccountsByOwner(
                    publicKey,
                    {
                        programId: TOKEN_PROGRAM_ID
                    }
                );
                setAllTokenList(tokenAccounts);
                await fetchTokenMetadata(tokenAccounts.value);
            }
        };
        getAllTokenList();
    }, [publicKey, connection]);


    const fetchTokenMetadata = async (tokenAccounts) => {
        const metadataList = [];
        const logoList = [];
        const tokenAmount = [];
        for (let key in tokenAccounts) {
            const [tokenMetadata, logo] = await getTokenMetadata(tokenAccounts[key]);
            metadataList.push(tokenMetadata);
            tokenAmount.push(getTokenData(tokenAccounts[key]).amount);
            logoList.push(logo);
        }
        setTokenBalance(tokenAmount);
        setTokenMetadataList(metadataList);
        setLogoList(logoList);
    };


    const getTokenMetadata = useCallback(async (tokenAccount) => {
        const tokenData = getTokenData(tokenAccount);
        const tokenMint = new PublicKey(tokenData.mint);
        const metadataPDA = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                PROGRAM_ID.toBuffer(),
                tokenMint.toBuffer(),
            ],
            PROGRAM_ID,
        )[0];
        const metadataAccount = await connection.getAccountInfo(metadataPDA);

        if (metadataAccount) {
            const [metadata, _] = await Metadata.deserialize(metadataAccount.data);
            try {
                const logoRes = await fetch(metadata.data.uri);
                const logoJson = await logoRes.json();
                const { image } = logoJson;
                return [{ tokenMetadata: metadata.data, ...metadata.data }, image];
            } catch (error) {
                console.error('Failed to fetch token metadata', error);
                return [metadata.data, null];
            }
        } else {
            console.error('No metadata account found');
            return [null, null];
        }
    }, [connection]);

    // Output {mint, amount}
    const getTokenData = (tokenAccount: { account: { data: Uint8Array; }; }) => {
        const accountData = AccountLayout.decode(tokenAccount.account.data);
        return accountData;
    };

    const onClick = useCallback(async (form) => {
        if (!publicKey || !sendTransaction) {
            notify({ type: 'error', message: `Please connect Wallet` });
            return;
        }

        if (!fromTokenData) {
            notify({ type: 'error', message: `No token selected!` });
            return;
        }

        try {
            const fromTokenAccount = await getAssociatedTokenAddress(
                fromTokenData.mint,
                publicKey
            );

            let toTokenAccount;
            try {
                toTokenAccount = await getAssociatedTokenAddress(
                    fromTokenData.mint,
                    new PublicKey(form.toWallet),
                );
            } catch (error) {
                // If the associated token account doesn't exist, create it
                toTokenAccount = await getAssociatedTokenAddress(
                    fromTokenData.mint,
                    new PublicKey(form.toWallet),
                    true // This flag ensures the associated token account is created if it doesn't exist
                );
            }

            const transaction = new Transaction();

            // Create the associated token account if it doesn't exist
            const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
            if (!toTokenAccountInfo) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        publicKey,
                        toTokenAccount,
                        new PublicKey(form.toWallet),
                        fromTokenData.mint
                    )
                );
            }

            transaction.add(
                createTransferInstruction(
                    fromTokenAccount,
                    toTokenAccount,
                    publicKey,
                    BigInt(form.amount) * BigInt(10 ** 9),
                    [],
                    TOKEN_PROGRAM_ID
                )
            );

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'confirmed');
            notify({ type: 'success', message: 'Transaction successful!' });
        } catch (error) {
            console.error("error", error);
            notify({ type: 'error', message: `Transaction failed!`, description: error?.message });
        }
    }, [publicKey, connection, sendTransaction, fromTokenData]);

    const selectToken = (value, index) => {
        const tokenData = getTokenData(value);
        setFromTokenData({ source: value.pubkey, mint: new PublicKey(tokenData.mint), amount: tokenData.amount });
        setSelectedTokenData(index + 1);
    }

    return (
        <div className="my-6">
            <Suspense fallback={<div>Loading...</div>}>
                {allTokenList && allTokenList.value.map((value: any, index: number) => {
                    const tokenData = getTokenData(value);
                    const tokenMetadata = tokenMetadataList[index];
                    const logo = logoList[index];
                    const balance = tokenBalance[index];
                    return (
                        <div key={"tokenData" + index}>
                            <div
                                className="flex cursor-pointer"
                                style={selectedTokenData === (index + 1) ? { color: "#9945FF" } : { color: "inherit" }}
                                onClick={() => selectToken(value, index)}>
                                <img src={logo} alt="token" width={25} height={25} />
                                {tokenMetadata &&
                                    <div className="flex">
                                        <span className="px-2">{tokenMetadata.name.replace(/\u0000/g, '')}</span>
                                        <span className="px-2">{tokenMetadata.symbol.replace(/\u0000/g, '')}</span>
                                        <span className="px-2">{String(balance)}</span>
                                    </div>
                                }
                            </div>
                            <br />
                        </div>
                    );
                })}
            </Suspense>
            <input
                type="text"
                className="form-control block mb-2 w-full px-4 py-2 text-xl font-normal text-gray-700 bg-white bg-clip-padding border border-solid border-gray-300 rounded transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
                placeholder="Receive Address"
                onChange={(e) => setDestinationAddress(e.target.value)}
            />
            <input
                type="number"
                className="form-control block mb-2 w-full px-4 py-2 text-xl font-normal text-gray-700 bg-white bg-clip-padding border border-solid border-gray-300 rounded transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
                placeholder="Transfer Amount"
                onChange={(e) => setTransferAmount(Number(e.target.value))}
            />
            <button
                className="px-8 m-2 btn animate-pulse bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:from-pink-500 hover:to-yellow-500 ..."
                onClick={() =>
                    onClick({
                        toWallet: destinationAddress,
                        amount: transferAmount,
                    })
                }
                disabled={!isConnected}
            >
                {isConnected ? <span>{buttonStatus.connected}</span> : <span>{buttonStatus.nonConnected}</span>}
            </button>
        </div>
    );
};
