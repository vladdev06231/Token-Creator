import { FC, useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { AccountLayout, TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import {
    DataV2,
    createUpdateMetadataAccountV2Instruction,
    PROGRAM_ID
} from "@metaplex-foundation/mpl-token-metadata";
import { notify } from 'utils/notifications';

const buttonStatus = {
    connected: "Transfer",
    nonConnected: "Please Connect Wallet!"
}

export const TransferToken: FC = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const [allTokenList, setAllTokenList] = useState<any>(null);
    const [destinationAddress, setDestinationAddress] = useState("");
    const [transferAmount, setTransferAmount] = useState<number>(0);
    const [isConnected, setIsConnected] = useState(false);
    const [selectedTokenData, setSelectedTokenData] = useState<number>(null);
    const [fromTokenData, setFromTokenData] = useState<{ source: PublicKey, mint: PublicKey, amount: any }>();

    useEffect(() => {
        const getAllTokenList = async () => {
            console.log("publicKey", publicKey);

            if (publicKey === null) {
                notify({ type: 'error', message: `Please connect Wallet` });
                return
            } else {
                setIsConnected(true)
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

    }, [publicKey, connection, sendTransaction]);


    //output-{mint, amount}
    const getTokenData = (tokenAccount: { account: { data: Uint8Array; }; }) => {
        const accountData = AccountLayout.decode(tokenAccount.account.data);
        return accountData
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
                new PublicKey(fromTokenData.mint),
                publicKey
            );

            const toTokenAccount = await getAssociatedTokenAddress(
                new PublicKey(fromTokenData.mint),
                new PublicKey(form.toWallet),
            );

            const createNewTokenTransaction = new Transaction().add(
                createTransferInstruction(
                    fromTokenAccount,
                    toTokenAccount,
                    publicKey,
                    form.amount,
                )
            )
            const signature = await sendTransaction(createNewTokenTransaction, connection);
            await connection.confirmTransaction(signature, 'confirmed');
            notify({ type: 'success', message: 'Transaction successful!', txid: bs58.encode(signature) });
        } catch (error) {
            console.log("error", error);
            notify({ type: 'error', message: `Transaction failed!`, description: error?.message });
        }
    }, [publicKey, connection, sendTransaction]);

    const selectToken = (value, index) => {
        const tokenData = getTokenData(value);
        setFromTokenData({ source: value.pubkey, mint: tokenData.mint, amount: tokenData.amount })
        setSelectedTokenData(index + 1);
    }

    return (
        <div className="my-6">
            {allTokenList && allTokenList.value.map((value: any, index: number) => {
                const tokenData = getTokenData(value);
                return (
                    <div key={"tokenData" + index}>
                        <span
                            className="cursor-pointer"
                            style={selectedTokenData === (index + 1) ? { color: "#9945FF" } : { color: "inherit" }}
                            onClick={() => selectToken(value, index)}>
                            {`${tokenData.mint}:${tokenData.amount}`}
                        </span>
                        <br />
                    </div>
                );
            })}
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
}

