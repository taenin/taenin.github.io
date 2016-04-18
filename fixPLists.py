import os,string, json
path = './JSONs'
path = os.path.normpath(path)
res = []
output = {}
for root,dirs,files in os.walk(path, topdown=True):
    for fileName in files:
        key = os.path.join(root, fileName).replace("\\","/")
        depth = key.count("/")
        data = {}
        with open(key, 'r') as data_file:    
            data = json.load(data_file)
        data["shape"] = map(lambda x: x / 32.0, data["shape"])
        with open(key, 'w') as data_file:
            json.dump(data, data_file)