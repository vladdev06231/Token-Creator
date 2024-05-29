// Next, React
import { FC } from 'react';
import { TransferToken } from 'components/TransferToken';

export const TrandferView: FC = ({ }) => {

  return (

    <div className="md:hero mx-auto p-4">
      <div className="md:hero-content flex flex-col">
        <h1 className="text-center text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-tr from-[#9945FF] to-[#14F195]">
          Token Transfer
        </h1>      
        <div className="text-center">
          <TransferToken />
        </div>
      </div>
    </div>
  );
};