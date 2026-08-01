import pandas as pd
import json
from unidecode import unidecode

# Abre o arquivo para leitura com codificação UTF-8
with open('./json/catalog.json', 'r', encoding='utf-8') as arquivo:
    dados = json.load(arquivo)

# print(dados)
df = pd.read_excel("C:/Users/User/Desktop/Balanciamento_final.xlsx", sheet_name='Capt. 2', header=1)
# print(df.iloc[:, 10:20])
# Inserir dados em uma exata coluna chamada 'NovaColuna'
# df['NovaColuna'] = [10, 20, 30]

# Salvar de volta para o Excel (sem salvar o índice numérico)
# df.to_excel('arquivo.xlsx', index=False)
indx = 0
for i, line in df.iterrows():
    if isinstance(line['Nome'],str) and line['Nome'] != '' and not line['Nome'].startswith('Capítulo '):
        indx+=1
        nome_sem_especiais = unidecode(line.Nome).replace(' ','').lower()
        id = f'{indx:>03d}{nome_sem_especiais}'
        df['Afinidades'].iloc[i] = ','.join(dados[id]['affinities'])
        
# print(df)
print(df.iloc[:, 2:20])
df.to_excel('arquivo.xlsx', index=False)