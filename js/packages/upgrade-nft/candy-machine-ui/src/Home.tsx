import { useEffect, useMemo, useState, useCallback } from 'react';
import * as anchor from '@project-serum/anchor';

import styled from 'styled-components';
import { Container, Snackbar, Button, TextField, Modal, CircularProgress, Grid } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import DragHandleIcon from '@material-ui/icons/DragHandle';
import Paper from '@material-ui/core/Paper';
import Alert from '@material-ui/lab/Alert';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogButton } from '@solana/wallet-adapter-material-ui';
import {
  awaitTransactionSignatureConfirmation,
  CandyMachineAccount,
  CANDY_MACHINE_PROGRAM,
  getCandyMachineState,
  mintOneToken,
  burnToken,
  getTokenAccount
} from './candy-machine';
import { AlertState, MpfpConfig } from './utils';
import { Header } from './Header';
import { MintButton } from './MintButton';
import { GatewayProvider } from '@civic/solana-gateway-react';

const ConnectButton = styled(WalletDialogButton)`
  width: 100%;
  height: 60px;
  margin-top: 10px;
  margin-bottom: 5px;
  background: linear-gradient(180deg, #604ae5 0%, #813eee 100%);
  color: white;
  font-size: 16px;
  font-weight: bold;
`;

const MintContainer = styled.div``; // add your owns styles here

export interface HomeProps {
  candyMachineId?: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  txTimeout: number;
  rpcHost: string;
}

const Home = (props: HomeProps) => {
  const [isUserMinting, setIsUserMinting] = useState(false);
  const [candyMachine, setCandyMachine] = useState<CandyMachineAccount>();
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: '',
    severity: undefined,
  });
  const [mpfpConfig, setMpfpConfig] = useState<MpfpConfig>({
    promoCode: '',
    didMintSucceed: false,
    sMpfpMint: '',
    oMpfpMint: '',
    uMpfpUri: '',

    oMpfpImage: '',
    oMpfpName: '',
    sMpfpImage: '',
    sMpfpName: '',
    uMpfpImage: '',
    uMpfpName: '',

  });

  const rpcUrl = props.rpcHost;
  const wallet = useWallet();

  const anchorWallet = useMemo(() => {
    if (
      !wallet ||
      !wallet.publicKey ||
      !wallet.signAllTransactions ||
      !wallet.signTransaction
    ) {
      return;
    }

    return {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction,
    } as anchor.Wallet;
  }, [wallet]);

  const refreshCandyMachineState = useCallback(async () => {
    if (!anchorWallet) {
      return;
    }

    if (props.candyMachineId) {
      try {
        const cndy = await getCandyMachineState(
          anchorWallet,
          props.candyMachineId,
          props.connection,
        );
        setCandyMachine(cndy);
      } catch (e) {
        console.log('There was a problem fetching Candy Machine state');
        console.log(e);
      }
    }
  }, [anchorWallet, props.candyMachineId, props.connection]);

  const onMint = async () => {
    // await getAndSetNFTData();

    try {
      setIsUserMinting(true);
      // setMpfpConfig({ ...mpfpConfig, didMintSucceed: true });

      document.getElementById('#identity')?.click();
      if (wallet.connected && candyMachine?.program && wallet.publicKey) {
        const mintTxId = (
          await mintOneToken(candyMachine, wallet.publicKey)
        )[0];

        let status: any = { err: true };
        if (mintTxId) {
          status = await awaitTransactionSignatureConfirmation(
            mintTxId,
            props.txTimeout,
            props.connection,
            true,
          );
        }

        if (status && !status.err) {
          setAlertState({
            open: true,
            message: 'Congratulations! Mint succeeded!',
            severity: 'success',
          });

        } else {
          setAlertState({
            open: true,
            message: 'Mint failed! Please try again!',
            severity: 'error',
          });
        }
      }
    } catch (error: any) {
      let message = error.msg || 'Minting failed! Please try again!';
      if (!error.msg) {
        if (!error.message) {
          message = 'Transaction Timeout! Please try again.';
        } else if (error.message.indexOf('0x137')) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf('0x135')) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          window.location.reload();
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: 'error',
      });
    } finally {
      setIsUserMinting(false);
      // Change the page
      setMpfpConfig({ ...mpfpConfig, didMintSucceed: true });
      await getAndSetNFTData();
    }
  };

  const getOwnedNFTs = async () : Promise<[string,string,string,string]> => {
    console.log('Getting list of owned NFTs');

    return new Promise((resolve) => {
      fetch(`https://a8a0-97-94-177-35.ngrok.io/api/metaplex-proxy-owner-nfts?wallet=${wallet.publicKey}`)
        .then(res => res.json())
        .then((nfts) => {
            console.log(nfts);
            resolve([
              nfts.mpfp_o.mint, nfts.mpfp_o.data.uri,
              nfts.mpfp_s.mint, nfts.mpfp_s.data.uri
            ]);
          },
          (error) => {
            console.log(error);
          }
        )
      });
  };

  const getAndSetNFTData = async () => {
    const nftData = await getOwnedNFTs();
    const oMpfpMint = nftData[0];
    const oMpfpUri = nftData[1];
    const sMpfpMint = nftData[2];
    const sMpfpUri = nftData[3];

    const [oMpfpName, oMpfpImage] = await getMetadata(oMpfpUri);
    const [sMpfpName, sMpfpImage] = await getMetadata(sMpfpUri);

    setMpfpConfig({ ...mpfpConfig,
      oMpfpImage: oMpfpImage, oMpfpName: oMpfpName, oMpfpMint: oMpfpMint,
      sMpfpImage: sMpfpImage, sMpfpName: sMpfpName, sMpfpMint: sMpfpMint
    });
  };

  const getMetadata = async (uri: string) : Promise<[string, string]> => {
    return new Promise((resolve) => {
      fetch(uri)
        .then(res => res.json())
        .then((metadata) => {
            console.log(metadata);
            resolve([metadata.name, metadata.image]);
          }
        )
    });
  };

  // Assumes that getOwnedNFTs has already been executed
  const upgradeNft = async () => {
    const oMpfpMint = mpfpConfig.oMpfpMint;
    const sMpfpMint = mpfpConfig.sMpfpMint;
    const url = `https://a8a0-97-94-177-35.ngrok.io/api/metaplex-proxy-mpfp?wallet=${wallet.publicKey}&nft=${oMpfpMint}`;

    // First, burn the Upgrade NFT
    const upgradeNFTMint = sMpfpMint;
    if (wallet.connected && candyMachine?.program && wallet.publicKey) {
      const tokenAcct = (await getTokenAccount(candyMachine, wallet.publicKey, upgradeNFTMint))[0];
      const mintTxId = (await burnToken(candyMachine, wallet.publicKey, upgradeNFTMint, tokenAcct))[0];

      // let status: any = { err: true };
      if (mintTxId) {
        await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          true,
        );

        console.log(mintTxId);

        // Then, do the upgrade (update original mpfp metadata + burn upgrade nft)
        fetch(url)
          .then(res => res.json())
          .then(async (updated_nft) => {
              console.log(updated_nft);
              // Get the updated metdata
              const [uMpfpName, uMpfpImage] = await getMetadata(updated_nft.uri);

              // Update the UI state
              setMpfpConfig({ ...mpfpConfig, uMpfpName: uMpfpName, uMpfpImage: uMpfpImage});
            },
            (error) => { console.log(error); }
          )
      }
    }

    // Old
    // First get the Minion NFT from wallet (if any)
    // fetch(`http://localhost:3000/api/metaplex-proxy-owner-nfts?wallet=${wallet.publicKey}`)
    //   .then(res => res.json())
    //   .then(
    //     (nfts) => {
    //       console.log(nfts);
    //
    //       // Check if the user has a Upgrade NFT
    //       if (!nfts.mpfp_s) {
    //         console.log("No upgrade NFT present");
    //         return;
    //       }
    //
    //       // Update the metadata
    //       fetch(`http://localhost:3000/api/metaplex-proxy-mpfp?wallet=${wallet.publicKey}&nft=${nfts.mpfp_o.mint}`)
    //         .then(res => res.json())
    //         .then(
    //           async (updated_nft) => {
    //             console.log(updated_nft);
    //             // Burn the Upgrade NFT
    //             const upgradeNFTMint = nfts.mpfp_s.mint || '';
    //             if (wallet.connected && candyMachine?.program && wallet.publicKey) {
    //               const tokenAcct = (await getTokenAccount(candyMachine, wallet.publicKey, upgradeNFTMint))[0];
    //               const mintTxId = (
    //                 burnToken(candyMachine, wallet.publicKey, upgradeNFTMint, tokenAcct)
    //               );
    //             }
    //           },
    //           (error) => { console.log(error); }
    //         )
    //     },
    //     (error) => { console.log(error); }
    //   )
  };

  useEffect(() => {
    refreshCandyMachineState();
  }, [
    anchorWallet,
    props.candyMachineId,
    props.connection,
    refreshCandyMachineState,
  ]);

  return (
    <Container style={{ marginTop: 40 }}>

      {wallet.connected && mpfpConfig.uMpfpImage &&
        <Modal
          open={true}
          onClose={() => true}>
          <Container maxWidth="sm" style={{ position: 'relative', marginTop: 70 }}>
            <Paper style={{ padding: 24, backgroundColor: '#151A1F', borderRadius: 6 }}>
              <img src={mpfpConfig.uMpfpImage} width="100%" alt="test1"/>
              <h1 style={{ textAlign: 'center', marginTop: '10px', paddingBottom: 10}}>{mpfpConfig.uMpfpName}</h1>
              <h2 style={{ textAlign: 'center', color: '#fdc838', marginBottom: '-10px' }}>
                Your Minion just Evolved!
              </h2>
              <p style={{ textAlign: 'center' }}>
                Check out your Minion in your wallet.
              </p>
            </Paper>
          </Container>
        </Modal>
      }

      {wallet.connected && mpfpConfig.oMpfpImage &&
        <Container maxWidth="lg" style={{ position: 'relative' }}>
          <Paper style={{ padding: 24, paddingBottom: 50, backgroundColor: '#151A1F', borderRadius: 6 }}>
            <h1 style={{ textAlign: 'center' }}>Whoa! Your Minion is about to evolve!</h1>
            <p style={{ fontSize: 18, textAlign: 'center', marginBottom: '50px' }}>Evolving your Minion will give it new traits and possibly a new personality! <br/>This action CANNOT be reversed.</p>
            <Grid container spacing={2}>
              <Grid item xs={3}>
                <img src={mpfpConfig.oMpfpImage} className="nftImg" style={{margin: '0 auto', display: 'block'}} alt="test2"/>
              </Grid>
              <Grid item xs={1}>
                <AddIcon style={{ marginTop: '100px', marginLeft: 20 }} fontSize="large"/>
              </Grid>
              <Grid item xs={3}>
                <img src={mpfpConfig.sMpfpImage} className="nftImg" style={{margin: '0 auto', display: 'block'}} alt="test3"/>
              </Grid>
              <Grid item xs={1}>
                <DragHandleIcon style={{ marginTop: '100px', marginLeft: 20 }} fontSize="large"/>
              </Grid>
              <Grid item xs={4}>
                <img src="https://bolderadvocacy.org/wp-content/uploads/2018/08/blue-icon-question-mark-image.png" width="260px" style={{ margin: '0 auto', display: 'block'}} alt="test4"/>
              </Grid>
            </Grid>
            <Button variant="contained" onClick={upgradeNft} className="custom" style={{ width: '400px', margin: '0 auto', display: 'block', marginTop: '50px'}}>
              ⚡ Evolve Now ⚡
            </Button>
          </Paper>
        </Container>
      }

      {!wallet.connected && !mpfpConfig.oMpfpImage &&
        <Container maxWidth="sm" style={{ position: 'relative' }}>
          <Paper style={{ padding: 20, paddingBottom: 34, backgroundColor: '#151A1F', borderRadius: 6 }}>
                <Container>
                  <h1 style={{textAlign: 'center'}}>
                    Thanks for purchasing <span style={{color:'#fdc838'}}>Minions: The Rise of Gru!</span>
                  </h1>
                  <img src="https://upload.wikimedia.org/wikipedia/en/4/45/Minions_The_Rise_of_Gru_poster.jpg" width="230px" style={{ display: 'block', margin: '0 auto'}} alt="test5"/>
                  <p style={{textAlign: 'center', paddingTop: '10px' }}>You should have received a promotion code from the affiliated theater to claim a free NFT. Connect your wallet below to redeem.</p>
                </Container>
                <ConnectButton>Connect Your Wallet</ConnectButton>
          </Paper>
        </Container>
      }

      {wallet.connected && !mpfpConfig.oMpfpImage &&
        <Container maxWidth="sm" style={{ position: 'relative' }}>
          <Paper style={{ padding: 24, backgroundColor: '#151A1F', borderRadius: 6 }}>
          {!mpfpConfig.didMintSucceed ?
            (<>
              <Container style={{ textAlign: 'center' }}>
                <h1 style={{textAlign: 'center'}}>
                  Thanks for purchasing <span style={{color:'#fdc838'}}>Minions: The Rise of Gru!</span>
                </h1>
                <img src="https://upload.wikimedia.org/wikipedia/en/4/45/Minions_The_Rise_of_Gru_poster.jpg" width="230px" style={{ display: 'block', margin: '0 auto'}} alt="test6"/>
                <p style={{textAlign: 'center', paddingTop: '10px' }}>You should have received a promotion code from the affiliated theater to claim a free NFT. Enter the code below to redeem.</p>
              </Container>
              <TextField id="outlined-basic"
                label="Enter promotion code"
                variant="outlined" onChange={(e) => setMpfpConfig({
                  ...mpfpConfig, promoCode: e.target.value })}
                value={mpfpConfig.promoCode}
                style={{ width: '100%', marginBottom: '15px' }}/>
              {
                <Header candyMachine={candyMachine} />
              }
              <MintContainer>
                {candyMachine?.state.isActive &&
                candyMachine?.state.gatekeeper &&
                wallet.publicKey &&
                wallet.signTransaction ? (
                  <GatewayProvider
                    wallet={{
                      publicKey:
                        wallet.publicKey ||
                        new PublicKey(CANDY_MACHINE_PROGRAM),
                      //@ts-ignore
                      signTransaction: wallet.signTransaction,
                    }}
                    gatekeeperNetwork={
                      candyMachine?.state?.gatekeeper?.gatekeeperNetwork
                    }
                    clusterUrl={rpcUrl}
                    options={{ autoShowModal: false }}
                  >
                    <MintButton
                      candyMachine={candyMachine}
                      isMinting={isUserMinting}
                      onMint={onMint}
                      hasPromoCode={mpfpConfig.promoCode !== ''}
                    />
                  </GatewayProvider>
                ) : (
                  <MintButton
                    candyMachine={candyMachine}
                    isMinting={isUserMinting}
                    onMint={onMint}
                    hasPromoCode={mpfpConfig.promoCode !== ''}
                  />
                )}
              </MintContainer>
            </>)
            : (<>
              <h3 style={{ textAlign: 'center' }}>Something interesting is happening...</h3>
              <CircularProgress style={{ margin: '0 auto', display: 'block', marginBottom: 10}} />
            </>)
          }
          </Paper>
        </Container>
      }

      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Home;
