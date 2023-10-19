import argparse,os
parser = argparse.ArgumentParser()
parser.add_argument("--name", type=str, default="test", help="Model name")
parser.add_argument("--dir", type=str, default="", help="Trainset dir")
args = parser.parse_args()
print(args)