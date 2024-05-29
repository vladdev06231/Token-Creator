import type { NextPage } from "next";
import Head from "next/head";
import { TrandferView } from "../views";

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
      <TrandferView />
    </div>
  );
};

export default Transfer;
