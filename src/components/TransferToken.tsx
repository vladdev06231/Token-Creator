import { FC, Suspense, useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey } from '@solana/web3.js';
import { AccountLayout, TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { notify } from 'utils/notifications';
import { Metadata, PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';

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
    const [tokenMetadata, setTokenMetadata] = useState(null);
    const [logo, setLogo] = useState(null);

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
            }
        };
        getAllTokenList();
    }, [publicKey, connection]);

    // Output {mint, amount}
    const getTokenData = (tokenAccount: { account: { data: Uint8Array; }; }) => {
        const accountData = AccountLayout.decode(tokenAccount.account.data);
        return accountData;
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
        )[0]
        const metadataAccount = await connection.getAccountInfo(metadataPDA);
        const [metadata, _] = await Metadata.deserialize(metadataAccount.data);
        let logoRes = await fetch(metadata.data.uri);
        let logoJson = await logoRes.json();
        let { image } = logoJson;
        return [{ tokenMetadata, ...metadata.data }, image];
    }, [allTokenList])

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
            {/* <Suspense fallback={<div>Loading...</div>}> */}
            {allTokenList && allTokenList.value.map(async (value: any, index: number) => {
                const tokenData = getTokenData(value);
                const [tokenMetadata, logo] = await getTokenMetadata(value);
                return (
                    <div key={"tokenData" + index}>
                        <div
                            className="cursor-pointer"
                            style={selectedTokenData === (index + 1) ? { color: "#9945FF" } : { color: "inherit" }}
                            onClick={() => selectToken(value, index)}>
                            <img src={logo} alt="token" width={25} height={25} />
                            {/* {tokenMetadata &&
                                <div>
                                    <span>{tokenMetadata.name}</span>
                                    <span>{tokenMetadata.symbol}</span>
                                    <span>{tokenData.amount}</span>
                                </div>
                            } */}
                        </div>
                        <br />
                    </div>
                );
            })}
            {/* </Suspense> */}
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
