import requests
import gzip
import io
import json
from typing import Dict, List, Any

UCSC_BASE = "https://hgdownload.soe.ucsc.edu/goldenPath"

# Map the names you want to the underlying UCSC assemblies
ASSEMBLY_ALIAS = {
    "hg38": "hg38",
    "grch38": "hg38",
    "hg19": "hg19",
    "grch37": "hg19",
}

# Canonical chroms; tweak if needed (e.g. remove chrM)
CANONICAL_CHROMS = {f"chr{i}" for i in range(1, 23)} | {"chrX", "chrY", "chrM"}


def fetch_text(url: str) -> str:
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.text


def fetch_gzip_text(url: str) -> str:
    resp = requests.get(url)
    resp.raise_for_status()
    with gzip.GzipFile(fileobj=io.BytesIO(resp.content)) as gz:
        return gz.read().decode("utf-8")


def natural_chrom_key(chrom_stripped: str):
    """
    Sort key for '1'..'22','X','Y','M' so numeric chromosomes come first.
    """
    if chrom_stripped.isdigit():
        return (0, int(chrom_stripped))
    order = {"X": 23, "Y": 24, "M": 25, "MT": 25}
    return (1, order.get(chrom_stripped, 100))


def load_chromosomes(ucsc_assembly: str) -> List[Dict[str, Any]]:
    """
    Load chromosome sizes from UCSC *.chrom.sizes and return:
    [
      {"chromosome": "1", "length": 248956422},
      ...
    ]
    Only includes CANONICAL_CHROMS.
    """
    url = f"{UCSC_BASE}/{ucsc_assembly}/bigZips/{ucsc_assembly}.chrom.sizes"
    text = fetch_text(url)

    chrom_map: Dict[str, int] = {}

    for line in text.splitlines():
        if not line.strip():
            continue
        chrom, size_str = line.split("\t")
        if chrom not in CANONICAL_CHROMS:
            continue
        size = int(size_str)

        # Strip "chr" prefix for the "chromosome" field; chrM -> "M"
        if chrom.startswith("chr"):
            name = chrom[3:]
        else:
            name = chrom

        chrom_map[name] = size

    chromosomes = [
        {"chromosome": name, "length": size}
        for name, size in sorted(chrom_map.items(), key=lambda kv: natural_chrom_key(kv[0]))
    ]
    return chromosomes


def load_cytobands(ucsc_assembly: str) -> List[Dict[str, Any]]:
    """
    Load cytobands from UCSC cytoBand.txt.gz and return:
    [
      {"chrom": "chr1", "chromStart": 0, "chromEnd": 2300000,
       "name": "p36.33", "stain": "gneg"},
      ...
    ]
    """
    url = f"{UCSC_BASE}/{ucsc_assembly}/database/cytoBand.txt.gz"
    text = fetch_gzip_text(url)

    cytobands: List[Dict[str, Any]] = []

    for line in text.splitlines():
        if not line.strip():
            continue
        chrom, start_str, end_str, name, stain = line.split("\t")

        cytobands.append({
            "chrom": chrom,
            "chromStart": int(start_str),
            "chromEnd": int(end_str),
            "name": name,
            "stain": stain,
        })

    return cytobands


def build_genome_object() -> Dict[str, Any]:
    """
    Build:
    {
      "hg38": { "chromosomes": [...], "cytobands": [...] },
      "grch38": { ...same as hg38... },
      "hg19": { ... },
      "grch37": { ...same as hg19... }
    }
    """
    result: Dict[str, Any] = {}
    cache_by_ucsc: Dict[str, Dict[str, Any]] = {}

    for label, ucsc in ASSEMBLY_ALIAS.items():
        if ucsc not in cache_by_ucsc:
            chromosomes = load_chromosomes(ucsc)
            cytobands = load_cytobands(ucsc)
            cache_by_ucsc[ucsc] = {
                "chromosomes": chromosomes,
                "cytobands": cytobands,
            }

        # Shallow-copy so aliases don't share the same list objects
        result[label] = {
            "chromosomes": list(cache_by_ucsc[ucsc]["chromosomes"]),
            "cytobands": list(cache_by_ucsc[ucsc]["cytobands"]),
        }

    return result


if __name__ == "__main__":
    genome_obj = build_genome_object()

    # Write to JSON file
    output_path = "genome_metadata.json"
    with open(output_path, "w") as f:
        json.dump(genome_obj, f, indent=2)

    print(f"Wrote genome metadata to {output_path}")
