#!/usr/bin/env python3
"""Build the compact Atlas Arcade river curriculum from the CWC river network KML."""

from __future__ import annotations

import argparse
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path


KML = "{http://www.opengis.net/kml/2.2}"

# The names mirror the river-system maps supplied as the curriculum reference.
RIVERS = [
    # Ganga system
    ("ganga_ref", "Ganga", "Ganga River", "Ganga", None),
    ("ganga_ref", "Yamuna", "Yamuna River", "Ganga", None),
    ("ganga_ref", "Tons", "Tons", "Ganga", "Yamuna Upper"),
    ("ganga_ref", "Hindon", "Hindon", "Ganga", None),
    ("ganga_ref", "Ramganga", "Ramganga River", "Ganga", None),
    ("ganga_ref", "Ghaghara", "Ghaghara River", "Ganga", None),
    ("ganga_ref", "Gomti", "Gomati River", "Ganga", None),
    ("ganga_ref", "Rapti", "Rapti River", "Ganga", None),
    ("ganga_ref", "Gandak", "Gandak River", "Ganga", None),
    ("ganga_ref", "Kosi", "Kosi River", "Ganga", None),
    ("ganga_ref", "Mahananda", "Mahananda", "Ganga", None),
    ("ganga_ref", "Son", "Sone River", "Ganga", None),
    ("ganga_ref", "Rihand", "Rihand", "Ganga", None),
    ("ganga_ref", "North Koel", "North Koel", "Ganga", None),
    ("ganga_ref", "Damodar", "Damodar River", "Ganga", None),
    ("ganga_ref", "Hooghly", "Hooghly River", "Ganga", None),
    ("ganga_ref", "Padma", "Ganga or Padma", "Ganga", None),
    ("ganga_ref", "Chambal", "Chambal River", "Ganga", None),
    ("ganga_ref", "Banas", "Banas River", "Ganga", "Banas"),
    ("ganga_ref", "Sind", "Sind River", "Ganga", None),
    ("ganga_ref", "Kali Sindh", "Kali Sindh", "Ganga", None),
    ("ganga_ref", "Parbati", "Parbati", "Ganga", "Kali Sindh and others up to Confluence with Parbati"),
    ("ganga_ref", "Betwa", "Betwa River", "Ganga", None),
    ("ganga_ref", "Dhasan", "Dhasan", "Ganga", None),
    ("ganga_ref", "Ken", "Ken", "Ganga", None),
    # Brahmaputra system
    ("brahmaputra_ref", "Brahmaputra", "Brahmaputra River", "Brahmaputra", None),
    ("brahmaputra_ref", "Subansiri", "Subansiri", "Brahmaputra", None),
    ("brahmaputra_ref", "Kameng", "Kameng", "Brahmaputra", None),
    ("brahmaputra_ref", "Manas", "Manas", "Brahmaputra", None),
    ("brahmaputra_ref", "Aie", "Aie", "Brahmaputra", None),
    ("brahmaputra_ref", "Teesta", "Teesta", "Brahmaputra", None),
    ("brahmaputra_ref", "Dibang", "Dibang", "Brahmaputra", None),
    ("brahmaputra_ref", "Lohit", "Lohit/Tellu", "Brahmaputra", None),
    ("brahmaputra_ref", "Burhi Dihing", "Burhi Dihing", "Brahmaputra", None),
    ("brahmaputra_ref", "Dhansiri", "Dhansiri", "Brahmaputra", None),
    ("brahmaputra_ref", "Kopili", "Kopili", "Brahmaputra", None),
    ("brahmaputra_ref", "Barak", "Barak River", "Barak and Others", None),
    ("brahmaputra_ref", "Surma", "Surma", "Barak and Others", None),
    ("brahmaputra_ref", "Meghna", "Meghna", "Barak and Others", None),
    # Narmada system
    ("narmada_ref", "Narmada", "Narmada River", "Narmada", None),
    ("narmada_ref", "Hiran", "Heran", "Narmada", "Narmada Lower"),
    ("narmada_ref", "Kolar", "Kolar", "Narmada", "Narmada Middle"),
    ("narmada_ref", "Orsang", "Orsang", "Narmada", None),
    ("narmada_ref", "Tawa", "Tawa", "Narmada", "Narmada Upper"),
    ("narmada_ref", "Shakkar", "Shakkar", "Narmada", None),
    ("narmada_ref", "Sher", "Sher", "Narmada", None),
    ("narmada_ref", "Banjar", "Banjar", "Narmada", None),
    ("narmada_ref", "Burhner", "Burhner", "Narmada", None),
    # Mahanadi system
    ("mahanadi_ref", "Mahanadi", "Mahanadi River", "Mahanadi", None),
    ("mahanadi_ref", "Seonath", "Seonath", "Mahanadi", None),
    ("mahanadi_ref", "Kharun", "Kharun", "Mahanadi", None),
    ("mahanadi_ref", "Hasdeo", "Hasdeo or Heshto", "Mahanadi", None),
    ("mahanadi_ref", "Mand", "Mand", "Mahanadi", "Mahanadi Middle"),
    ("mahanadi_ref", "Ib", "Ib", "Mahanadi", None),
    ("mahanadi_ref", "Jonk", "Jonk", "Mahanadi", None),
    ("mahanadi_ref", "Ong", "Ong", "Mahanadi", None),
    ("mahanadi_ref", "Indra", "Indra Or Sundari", "Mahanadi", None),
    ("mahanadi_ref", "Tel", "Tel", "Mahanadi", "Mahanadi Lower"),
    # Godavari system
    ("godavari_ref", "Godavari", "Godavari River", "Godavari", None),
    ("godavari_ref", "Pravara", "Pravara", "Godavari", None),
    ("godavari_ref", "Manjira", "Manjra River", "Godavari", None),
    ("godavari_ref", "Purna", "Purna", "Godavari", "Godavari Middle"),
    ("godavari_ref", "Penganga", "Penganga River", "Godavari", None),
    ("godavari_ref", "Wardha", "Wardha River", "Godavari", None),
    ("godavari_ref", "Wainganga", "Wainganga River", "Godavari", None),
    ("godavari_ref", "Pranahita", "Pranhitha", "Godavari", None),
    ("godavari_ref", "Manair", "Maner", "Godavari", None),
    ("godavari_ref", "Indravati", "Indravati River", "Godavari", None),
    ("godavari_ref", "Sabari", "Kolab / Sabari", "Godavari", None),
    ("godavari_ref", "Kinnerasani", "Kinnarasani", "Godavari", None),
    # Krishna system
    ("krishna_ref", "Krishna", "Krishna River", "Krishna", None),
    ("krishna_ref", "Bhima", "Bhima River", "Krishna", None),
    ("krishna_ref", "Koyna", "Koyna", "Krishna", None),
    ("krishna_ref", "Panchganga", "Panchaganga", "Krishna", None),
    ("krishna_ref", "Dudhganga", "Dudhganga", "Krishna", "Krishna Upper"),
    ("krishna_ref", "Ghataprabha", "Ghatprabha", "Krishna", None),
    ("krishna_ref", "Malaprabha", "Malprabha", "Krishna", None),
    ("krishna_ref", "Don", "Don", "Krishna", "Krishna Upper"),
    ("krishna_ref", "Tungabhadra", "Tungabhadra River", "Krishna", None),
    ("krishna_ref", "Tunga", "Tunga", "Krishna", None),
    ("krishna_ref", "Bhadra", "Bhadra", "Krishna", "Tungabhadra Upper"),
    ("krishna_ref", "Dindi", "Dindi", "Krishna", None),
    ("krishna_ref", "Musi", "Musi", "Krishna", "Krishna Lower"),
    ("krishna_ref", "Munneru", "Pakhal or Muneru", "Krishna", None),
]

NATURAL_EARTH_NAMES = {
    "Ganga": "Ganges",
    "Yamuna": "Yamuna",
    "Ghaghara": "Ghaghara",
    "Gandak": "Gandak",
    "Son": "Son",
    "Chambal": "Chambal",
    "Banas": "Banas",
    "Parbati": "Parbati",
    "Betwa": "Betwa",
    "Brahmaputra": "Brahmaputra",
    "Teesta": "Teesta",
    "Manas": "Manas",
    "Narmada": "Narmada",
    "Mahanadi": "Mahanadi",
    "Tel": "Tel",
    "Godavari": "Godavari",
    "Wainganga": "Wainganga",
    "Indravati": "Indravati",
    "Krishna": "Krishna",
    "Bhima": "Bhima",
    "Tungabhadra": "Tungabhadra",
}

OSM_PREFERRED = {"Mahanadi", "Godavari", "Krishna", "Mahananda"}

PARENTS = {
    # Ganga network
    "Yamuna": "Ganga", "Tons": "Yamuna", "Hindon": "Yamuna", "Ramganga": "Ganga",
    "Ghaghara": "Ganga", "Gomti": "Ganga", "Rapti": "Ghaghara", "Gandak": "Ganga",
    "Kosi": "Ganga", "Mahananda": "Padma", "Son": "Ganga", "Rihand": "Son",
    "North Koel": "Son", "Damodar": "Hooghly", "Hooghly": "Ganga", "Padma": "Ganga",
    "Chambal": "Yamuna", "Banas": "Chambal", "Sind": "Yamuna", "Kali Sindh": "Chambal",
    "Parbati": "Chambal", "Betwa": "Yamuna", "Dhasan": "Betwa", "Ken": "Yamuna",
    # Brahmaputra-Barak-Meghna network
    "Subansiri": "Brahmaputra", "Kameng": "Brahmaputra", "Manas": "Brahmaputra",
    "Aie": "Manas", "Teesta": "Brahmaputra", "Dibang": "Lohit", "Lohit": "Brahmaputra",
    "Burhi Dihing": "Brahmaputra", "Dhansiri": "Brahmaputra", "Kopili": "Brahmaputra",
    "Barak": "Surma", "Surma": "Meghna",
    # Narmada network
    "Hiran": "Narmada", "Kolar": "Narmada", "Orsang": "Narmada", "Tawa": "Narmada",
    "Shakkar": "Narmada", "Sher": "Narmada", "Banjar": "Narmada", "Burhner": "Narmada",
    # Mahanadi network
    "Seonath": "Mahanadi", "Kharun": "Seonath", "Hasdeo": "Mahanadi", "Mand": "Mahanadi",
    "Ib": "Mahanadi", "Jonk": "Mahanadi", "Ong": "Mahanadi", "Indra": "Tel", "Tel": "Mahanadi",
    # Godavari network
    "Pravara": "Godavari", "Manjira": "Godavari", "Purna": "Godavari", "Penganga": "Wardha",
    "Wardha": "Pranahita", "Wainganga": "Pranahita", "Pranahita": "Godavari", "Manair": "Godavari",
    "Indravati": "Godavari", "Sabari": "Godavari", "Kinnerasani": "Godavari",
    # Krishna network
    "Bhima": "Krishna", "Koyna": "Krishna", "Panchganga": "Krishna", "Dudhganga": "Krishna",
    "Ghataprabha": "Krishna", "Malaprabha": "Krishna", "Don": "Krishna",
    "Tungabhadra": "Krishna", "Tunga": "Tungabhadra", "Bhadra": "Tungabhadra",
    "Dindi": "Krishna", "Musi": "Krishna", "Munneru": "Krishna",
}


def point_distance(a: list[float], b: list[float]) -> float:
    scale = math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot((a[0] - b[0]) * scale, a[1] - b[1])


def point_segment_distance(point: list[float], start: list[float], end: list[float]) -> float:
    scale = math.cos(math.radians(point[1]))
    px, py = point[0] * scale, point[1]
    ax, ay = start[0] * scale, start[1]
    bx, by = end[0] * scale, end[1]
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplify(line: list[list[float]], tolerance: float = 0.003) -> list[list[float]]:
    if len(line) <= 2:
        return line
    furthest, index = 0.0, 0
    for i in range(1, len(line) - 1):
        distance = point_segment_distance(line[i], line[0], line[-1])
        if distance > furthest:
            furthest, index = distance, i
    if furthest <= tolerance:
        return [line[0], line[-1]]
    left = simplify(line[: index + 1], tolerance)
    right = simplify(line[index:], tolerance)
    return left[:-1] + right


def parse_coordinates(text: str | None) -> list[list[float]]:
    points = []
    for item in (text or "").split():
        values = item.split(",")
        if len(values) >= 2:
            points.append([round(float(values[0]), 5), round(float(values[1]), 5)])
    return points


def dedupe_lines(lines: list[list[list[float]]]) -> list[list[list[float]]]:
    unique = []
    for line in sorted((line for line in lines if len(line) > 1), key=len, reverse=True):
        duplicate = any(
            (
                point_distance(line[0], other[0]) < 0.012
                and point_distance(line[-1], other[-1]) < 0.012
            ) or (
                point_distance(line[0], other[-1]) < 0.012
                and point_distance(line[-1], other[0]) < 0.012
            )
            for other in unique
        )
        if not duplicate:
            unique.append(line)
    return unique


def merge_lines(lines: list[list[list[float]]], max_gap: float = 0.08) -> list[list[float]]:
    chains = dedupe_lines(lines)
    while len(chains) > 1:
        best = None
        for i, first in enumerate(chains):
            for j in range(i + 1, len(chains)):
                second = chains[j]
                options = [
                    (point_distance(first[-1], second[0]), "end-start"),
                    (point_distance(first[-1], second[-1]), "end-end"),
                    (point_distance(first[0], second[-1]), "start-end"),
                    (point_distance(first[0], second[0]), "start-start"),
                ]
                gap, join = min(options)
                if best is None or gap < best[0]:
                    best = (gap, i, j, join)
        if best is None or best[0] > max_gap:
            break
        _, i, j, join = best
        first, second = chains[i], chains[j]
        if join == "end-start":
            merged = first + second[1:]
        elif join == "end-end":
            merged = first + list(reversed(second))[1:]
        elif join == "start-end":
            merged = second + first[1:]
        else:
            merged = list(reversed(second)) + first[1:]
        chains[i] = merged
        chains.pop(j)
    return max(chains, key=len) if chains else []


def source_to_outlet_lines(record: dict) -> list[list[list[float]]]:
    lines = dedupe_lines(record["lines"])
    props = record["properties"]
    source = [float(props["st_pt_long"]), float(props["st_pt_lat"])]
    outlet = [float(props["en_pt_long"]), float(props["en_pt_lat"])]
    upstream = min(
        lines,
        key=lambda line: min(point_distance(line[0], source), point_distance(line[-1], source)),
    )
    if point_distance(upstream[-1], source) < point_distance(upstream[0], source):
        upstream = list(reversed(upstream))
    candidates = []
    for line in lines:
        if line is upstream:
            continue
        start_gap = point_distance(upstream[-1], line[0])
        end_gap = point_distance(upstream[-1], line[-1])
        if min(start_gap, end_gap) > 0.08:
            continue
        other_end = line[-1] if start_gap <= end_gap else line[0]
        candidates.append((point_distance(other_end, outlet), line))
    if not candidates:
        return [upstream]
    downstream = min(candidates, key=lambda item: item[0])[1]
    return [upstream, downstream]


def read_cwc(kml_path: Path) -> list[dict]:
    records = []
    for _, element in ET.iterparse(kml_path, events=("end",)):
        if element.tag != KML + "Placemark":
            continue
        props = {
            node.attrib.get("name"): (node.text or "").strip()
            for node in element.findall(".//" + KML + "SimpleData")
        }
        lines = [parse_coordinates(node.text) for node in element.findall(".//" + KML + "coordinates")]
        records.append({"properties": props, "lines": lines})
        element.clear()
    return records


def choose_record(records: list[dict], source_name: str, basin: str, sub_basin: str | None) -> dict | None:
    matches = [
        record for record in records
        if record["properties"].get("rivname") == source_name
        and record["properties"].get("ba_name") == basin
        and (sub_basin is None or record["properties"].get("sub_basin") == sub_basin)
    ]
    if not matches:
        return None
    return max(matches, key=lambda record: float(record["properties"].get("length_km") or 0))


def read_overpass_river(overpass_path: Path | None, river_name: str) -> list[list[float]] | None:
    if not overpass_path or not overpass_path.exists():
        return None
    data = json.loads(overpass_path.read_text())
    source_names = {
        "Surma": {"Surma River", "Surma river"},
        "Meghna": {"Meghna River"},
    }[river_name]
    lines = [
        [[round(point["lon"], 5), round(point["lat"], 5)] for point in element.get("geometry", [])]
        for element in data.get("elements", [])
        if (element.get("tags", {}).get("name:en") or element.get("tags", {}).get("name")) in source_names
    ]
    return merge_lines(lines)


def read_natural_earth(path: Path | None) -> dict:
    if not path or not path.exists():
        return {}
    data = json.loads(path.read_text())
    output = {}
    for name, source_name in NATURAL_EARTH_NAMES.items():
        lines = []
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            if source_name not in {props.get("name"), props.get("name_en"), props.get("name_alt")}:
                continue
            geometry = feature.get("geometry", {})
            if geometry.get("type") == "LineString":
                lines.append(geometry.get("coordinates", []))
            elif geometry.get("type") == "MultiLineString":
                lines.extend(geometry.get("coordinates", []))
        if lines:
            output[name] = merge_lines(lines, 0.12)
    return output


def read_osm(path: Path | None) -> dict:
    if not path or not path.exists():
        return {}
    data = json.loads(path.read_text())
    output = {}
    for feature in data.get("features", []):
        name = feature.get("properties", {}).get("name")
        if not name:
            continue
        geometry = feature.get("geometry", {})
        lines = geometry.get("coordinates", [])
        if geometry.get("type") == "LineString":
            lines = [lines]
        output[name] = merge_lines(lines, 0.16 if name == "Mahanadi" else 0.13)
    return output


def trim_ganga_at_farakka(line: list[list[float]]) -> list[list[float]]:
    source = [79.84, 30.89]
    farakka = [88.14, 24.56]
    if point_distance(line[-1], source) < point_distance(line[0], source):
        line = list(reversed(line))
    cut = min(range(len(line)), key=lambda index: point_distance(line[index], farakka))
    return line[: cut + 1]


def closest_point(point: list[float], start: list[float], end: list[float]) -> tuple[float, list[float]]:
    scale = math.cos(math.radians(point[1]))
    px, py = point[0] * scale, point[1]
    ax, ay = start[0] * scale, start[1]
    bx, by = end[0] * scale, end[1]
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return point_distance(point, start), start
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    result = [start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1])]
    return point_distance(point, result), result


def connect_to_parent(line: list[list[float]], parent: list[list[float]]) -> tuple[list[list[float]], float]:
    best = None
    for side, endpoint in (("start", line[0]), ("end", line[-1])):
        for index in range(1, len(parent)):
            distance, point = closest_point(endpoint, parent[index - 1], parent[index])
            if best is None or distance < best[0]:
                best = (distance, side, point)
    if best is None:
        return line, math.inf
    distance, side, point = best
    point = [round(point[0], 5), round(point[1], 5)]
    if side == "start":
        return [point] + line, distance
    return line + [point], distance


def extend_brahmaputra_to_meghna(features: list[dict], osm: dict) -> None:
    by_name = {feature["properties"]["name"]: feature for feature in features}
    brahmaputra = by_name.get("Brahmaputra")
    meghna = by_name.get("Meghna")
    lower_course = osm.get("Ganga")
    if not brahmaputra or not meghna or not lower_course:
        return
    trunk = brahmaputra["geometry"]["coordinates"]
    distance_from_start = min(point_distance(trunk[0], point) for point in lower_course)
    distance_from_end = min(point_distance(trunk[-1], point) for point in lower_course)
    if distance_from_start < distance_from_end:
        trunk.reverse()
    start = min(range(len(lower_course)), key=lambda index: point_distance(lower_course[index], trunk[-1]))
    end, gap = min(
        (
            (index, min(point_distance(point, target) for target in meghna["geometry"]["coordinates"]))
            for index, point in enumerate(lower_course[start:], start=start)
        ),
        key=lambda item: item[1],
    )
    if end <= start or gap > 0.08:
        return
    bridge = lower_course[start : end + 1]
    if point_distance(bridge[0], trunk[-1]) > point_distance(bridge[-1], trunk[-1]):
        bridge.reverse()
    brahmaputra["geometry"]["coordinates"] = trunk + bridge[1:]
    brahmaputra["properties"]["lowerCourse"] = "Padma-Meghna confluence"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("kml", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--east-overpass", type=Path)
    parser.add_argument("--natural-earth", type=Path)
    parser.add_argument("--osm", type=Path)
    args = parser.parse_args()

    records = read_cwc(args.kml)
    natural_earth = read_natural_earth(args.natural_earth)
    osm = read_osm(args.osm)
    features = []
    missing = []
    for system, name, source_name, basin, sub_basin in RIVERS:
        if name in osm and name in OSM_PREFERRED:
            line = osm[name]
            props = {"length_km": None, "Confluence": None}
            source = "OpenStreetMap"
        elif name in natural_earth:
            line = natural_earth[name]
            props = {"length_km": None, "Confluence": None}
            source = "Natural Earth"
        elif name in {"Surma", "Meghna"}:
            line = read_overpass_river(args.east_overpass, name)
            props = {"length_km": None, "Confluence": "Bay of Bengal"}
            source = "OpenStreetMap"
        else:
            record = choose_record(records, source_name, basin, sub_basin)
            lines = list(record["lines"]) if record else []
            if name == "Dibang" and record:
                lines = source_to_outlet_lines(record)
            if name == "Kameng":
                lower = choose_record(records, "Bhareli", "Brahmaputra", None)
                lines.extend(lower["lines"] if lower else [])
            if name == "Hooghly":
                upper = choose_record(records, "Bhagirathi", "Ganga", "Bhagirathi and others (Ganga Lower)")
                lines.extend(upper["lines"] if upper else [])
            line = merge_lines(lines) if lines else None
            props = record["properties"] if record else {}
            source = "Central Water Commission"
        if not line:
            missing.append(name)
            continue
        if name == "Ganga":
            line = trim_ganga_at_farakka(line)
        compact = simplify(line)
        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "system": system,
                "source": source,
                "lengthKm": float(props["length_km"]) if props.get("length_km") else None,
                "confluence": props.get("Confluence") or None,
            },
            "geometry": {"type": "LineString", "coordinates": compact},
        })

    if missing:
        raise SystemExit("Missing river geometry: " + ", ".join(missing))
    extend_brahmaputra_to_meghna(features, osm)
    by_name = {feature["properties"]["name"]: feature for feature in features}
    for name, parent_name in PARENTS.items():
        feature = by_name.get(name)
        parent = by_name.get(parent_name)
        if not feature or not parent:
            continue
        line, gap = connect_to_parent(feature["geometry"]["coordinates"], parent["geometry"]["coordinates"])
        # A short join closes mapping-data seams. Larger gaps are reported rather than replaced by a false chord.
        if gap <= 0.18:
            feature["geometry"]["coordinates"] = line
        feature["properties"]["parent"] = parent_name
        feature["properties"]["confluenceGap"] = round(gap, 4)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({
        "type": "FeatureCollection",
        "source": "Central Water Commission River Network, National Water Data Portal; OpenStreetMap for Meghna",
        "features": features,
    }, separators=(",", ":")) + "\n")
    print(f"Wrote {len(features)} rivers to {args.output}")


if __name__ == "__main__":
    main()
