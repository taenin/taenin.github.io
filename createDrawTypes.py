import os,string, json
path = './textures'
path = os.path.normpath(path)
res = []
output = {}
for root,dirs,files in os.walk(path, topdown=True):
    for folder in dirs:
        key = os.path.join(root, folder).replace("\\","/")
        depth = key.count("/")
        if depth == 1:
            output[folder] = {}
            output[folder]["img"] = []
            output[folder]["hasSubCategory"] = False
    if len(files) > 0:
        key = os.path.join(root, files[0]).replace("\\","/")
        depth = key.count("/")
        if depth == 2:
            _,category, _ = key.split("/")
            output[category]["img"] =  [os.path.join(root, imageFile).replace("\\","/") for imageFile in files]
            output[category]["hasSubCategory"] = False
        elif depth==3:
            _,category, subcategory, _ = key.split("/")
            output[category]["hasSubCategory"] = True
            imgSet = {
                "name": subcategory,
                "imgList":[os.path.join(root, imageFile).replace("\\","/") for imageFile in files]
            }
            output[category]["img"].append(imgSet)
with open('drawTypes.json', 'w') as f:
    json.dump(output, f)