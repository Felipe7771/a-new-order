import pandas as pd
import json
from unidecode import unidecode

df = pd.read_excel("C:/Users/User/Desktop/Balanciamento_final.xlsx", sheet_name='Capt. 2', header=1)
df.dropna(axis=1, how='all', inplace=True)
dtf = df.fillna("Não informado")

df_pow = pd.read_excel("C:/Users/User/Desktop/Balanciamento_final.xlsx", sheet_name='Poder')
df_pow.dropna(axis=1, how='all', inplace=True)
dtf_pow = df_pow.fillna("Não informado")

# Exibe as primeiras linhas da tabela
def Binry2txt(value, text):
    return text if (isinstance(value, (int, float)) and value >= 1) else ''

database = {}

indx = 0
for _, line in dtf.iterrows():
    if line['Nome'] not in ('Não informado','') and not line['Nome'].startswith('Capítulo '):
        indx+=1
        
        index = f'{indx:>03d}'
        
        nome_sem_especiais = unidecode(line.Nome).replace(' ','').lower()
        id = f'{index}{nome_sem_especiais}'
        database[id] = {
            'name': line.Nome,
            'stats': {
                'baseLife': line.vida,
                'baseDamage': line.Dano
            },
            'attbtLife': list(filter(None, [
                Binry2txt(line['intocável'],'implacable'),
                Binry2txt(line['guardião'],'guardian'),
                ]
            )),
            'attbtDamage': list(filter(None, [
                Binry2txt(line['dano em área'],'area'),
                Binry2txt(line['todas as fileiras'],'entire_arena'),
                Binry2txt(line['perfurador'],'drill'),
                Binry2txt(line['mortal'],'mortal'),
                Binry2txt(line['Fúria'],'rage'),
                ]
            )),
            
            'rageDamage': line['Fúria'] if isinstance(line['Fúria'],(int, float)) else 0,
            
            'group': line['Alianças'],
            'affinities': [a.strip() for a in line['Afinidades'].split(',')] if line['Afinidades'] != 'Não informado' else [],
            'animation': {
                'reserve': {
                    'entrance': '',
                    'default': f'img/doll/{index}/{index}_reserve_default.png',
                },
                
                'board': {
                    'entrance': f'img/doll/{index}/{index}_board_entrance.webm',
                    'default': f'img/doll/{index}/{index}_board_default.webm',
                    'exit': f'img/doll/{index}/{index}_board_exit.webm',
                },
            }
        }
       
        
indx = 0
for _, line in dtf_pow.iterrows():
    if line['Nome'] not in ('Não informado','') and not line['Nome'].startswith('Capítulo '):
        indx+=1
        
        nome_sem_especiais = unidecode(line.Nome).replace(' ','').lower()
        id = f'{indx:>03d}{nome_sem_especiais}'
        
        has_power = line['Poder'] not in ('Não informado','')
        
        database[id]['power'] = {
            'has': has_power,
            'description': line.Poder if has_power else ''
        }
           
with open("./json/catalog.json", "w", encoding="utf-8") as arquivo:
    # indent=4 é usado para deixar o JSON legível e formatado
    json.dump(database, arquivo, ensure_ascii=False, indent=4)

print("Arquivo JSON criado com sucesso!") 

        
# for key, value in database.items():
#     print(key)
#     print(value)
#     print('------------------')
