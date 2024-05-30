import type { NextPage } from "next";
import Head from "next/head";
import { TransferView } from "../views"

const Transfer: NextPage = (props) => {

  return (
    <div>
      <Head>
        <title>Solana Scaffold</title>
        <meta
          name="description"
          content="Solana Scaffold"
        />
      </Head>
      <TransferView />
    </div>
  );
};

export default Transfer;
