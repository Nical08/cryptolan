# cryptolan
chat locale completamente criptata senza server centrale

# prerequisiti
Per avviare il progetto prima di tutto bisogna avere Node Js installato
inoltre bisogna avere aperte le 2 porte del firewall
tramite powershell come administratore

```bash
#apertura porte
New-NetFirewallRule -DisplayName "Scoperta Multicast TCP 50001" -Direction Inbound -Protocol TCP -LocalPort 50001 -Action Allow
New-NetFirewallRule -DisplayName "Scoperta Multicast UDP 50001" -Direction Inbound -Protocol UDP -LocalPort 50001 -Action Allow
New-NetFirewallRule -DisplayName "Connessione PC TCP 50000" -Direction Inbound -Protocol TCP -LocalPort 50000 -Action Allow
New-NetFirewallRule -DisplayName "Connessione PC UDP 50000" -Direction Inbound -Protocol UDP -LocalPort 50000 -Action Allow
```


Prima di avviare il progetto bisogna eseguire il comando 
Dalla root del progetto

```bash
#installazone delle dipendenze
npm install 
```




# avviamento

Per avviare il progetto bisogna usare il comando

```bash
#start del progetto
npm start
```

Dopo averlo avviato scegliere il proprio nome utente (sara obbligtorio per fare gli acessi successibvi)
