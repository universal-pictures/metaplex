import { useEffect, useMemo, useState, useCallback } from 'react';
import * as anchor from '@project-serum/anchor';

import styled from 'styled-components';
import { Container, Snackbar, Button, Grid, Divider, Chip} from '@material-ui/core';
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

const BACKGROUND_URL = 'https://i.pinimg.com/originals/72/88/7b/72887b864106cc1b0a110c28a9f3aca6.jpg';

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
    didInstallWallet: false
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
    try {
      setIsUserMinting(true);
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
            message: 'Congratulations! Mint succeeded. Check your wallet to meet your new Minion!',
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
    }
  };

  const updateDidInstallWallet = () => {
    console.log('redirecting to phantom');
    setMpfpConfig({
      didInstallWallet: true
    });
    window.open('https://phantom.app/', '_blank');
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
    <Container style={{ marginTop: 120 }}>
      {!wallet.connected ? (
        <Container maxWidth="sm" style={{ position: 'relative', textAlign: 'center' }} fixed>
          <Paper
            style={{ padding: 24, backgroundColor: '#151A1F', borderRadius: 6 }}
            elevation={3}
          >
            <Container style={{ paddingBottom: 25}}>
              <h3>JOIN</h3>
              <h1 style={{color: '#fdc838'}}>THE MINIONVERSE</h1>
              <img src={BACKGROUND_URL} width="100%"/>
              {!wallet.connected && !mpfpConfig.didInstallWallet ? (
                <Button className="custom" variant="contained" onClick={updateDidInstallWallet}
                  style={{ marginTop: 24 }}>
                  Install Phantom Wallet

                </Button>
              ) : (
                <ConnectButton className="custom" style={{ marginTop: 24 }}>Connect Your Wallet</ConnectButton>
              )}
            </Container>
          </Paper>
        </Container>
        ) : (
          <>
          <Container maxWidth="lg" style={{ position: 'relative' }} fixed>
            <Paper
              style={{ padding: 24, backgroundColor: '#151A1F', borderRadius: 6 }}
              elevation={3}
            >
              <Container style={{ paddingBottom: 10 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <h1>JOIN | <span style={{color:'#fdc838'}}>THE MINIONVERSE</span></h1>
                    <Chip label="13,500 Unique Minions to Collect!" variant="default" size="medium"/>
                    <h1 style={{fontSize: 26}}>Attributes</h1>
                    <ul>
                      <li>3 Eye Types</li>
                      <li>10 Skin Tones</li>
                      <li>30 Accessories</li>
                      <li>15 Unique Personalities</li>
                    </ul>
                    <Divider />
                    <Header candyMachine={candyMachine} />
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
                          />
                        </GatewayProvider>
                      ) : (
                        <MintButton
                          candyMachine={candyMachine}
                          isMinting={isUserMinting}
                          onMint={onMint}
                        />
                      )}
                    </MintContainer>
                  </Grid>
                  <Grid item xs={6}>
                    <img src={BACKGROUND_URL} width="100%"/>
                  </Grid>
                </Grid>
              </Container>
            </Paper>
          </Container>
          </>
      )}

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
