#!/usr/bin/env python3
"""Reference implementation of docs/07-scoring-spec.md (rules v1.0.0).
Run: python3 fixtures/score_reference.py
The TypeScript scoring engine MUST match these results on the fixtures."""
import json, re, sys
from datetime import date

CAPS = {"STATUTORY":30,"CORPORATE":20,"LEGAL":25,"ADVERSE":15,"LEGITIMACY":10}
PRIMARY = {"STATUTORY":"gst","CORPORATE":"mca","LEGAL":"legal","ADVERSE":"news","LEGITIMACY":"udyam"}

def months_between(d, today):
    y,m,dd = map(int,d.split("-")); return (today.year-y)*12 + (today.month-m) + (today.day-dd)/31

def norm(n):
    n = re.sub(r"\(.*?\)","",n.lower()); n = n.replace("pvt","private").replace("ltd","limited")
    return set(re.sub(r"[^a-z0-9 ]"," ",n).split())
def sim(a,b):
    A,B = norm(a),norm(b)
    if not A or not B: return 1.0
    inter = A&B
    return max(len(inter)/len(A), len(inter)/len(B)) if (A<=B or B<=A) else 2*len(inter)/(len(A)+len(B))

def evaluate(sub, ad, today):
    F=[]  # (rule, group, category, penalty, hard, title)
    g=ad.get("gst")
    if g and g["status"]=="ok":
        if (g.get("registrationStatus") or "").lower() in ("cancelled","suspended"):
            F.append(("GST-01","G-STATUS","STATUTORY",30,True,"GST registration "+g["registrationStatus"].lower()))
        r=g.get("returns") or []
        if r:
            r=sorted(r,key=lambda x:x["period"])
            if all(x["status"]=="Not Filed" for x in r[-3:]): F.append(("GST-02","G-FILING","STATUTORY",15,False,"No GSTR-3B in last 3 periods"))
            missed=sum(1 for x in r if x["status"]=="Not Filed")
            late=0
            for x in r:
                if x["status"]=="Filed" and x["filedDate"]:
                    y,m=map(int,x["period"].split("-")); ny,nm=(y,m+1) if m<12 else (y+1,1)
                    if x["filedDate"]>f"{ny}-{nm:02d}-20": late+=1
            if missed>=6: F.append(("GST-03","G-FILING","STATUTORY",15,False,"Frequent missed GSTR-3B"))
            elif missed>=3: F.append(("GST-03","G-FILING","STATUTORY",8,False,"Repeated missed GSTR-3B"))
            elif late>=4: F.append(("GST-03","G-FILING","STATUTORY",4,False,"Repeated late GSTR-3B"))
        if g.get("registrationDate") and months_between(g["registrationDate"],today)<12:
            F.append(("GST-04","G-AGE","STATUTORY",4,False,"Registered under 12 months ago"))
    m=ad.get("mca")
    disq=set()
    if m and m["status"]=="ok":
        if (m.get("companyStatus") or "Active")!="Active": F.append(("MCA-01","G-STATUS","CORPORATE",20,True,"Company not active"))
        bs=m.get("lastBalanceSheetDate"); agm=m.get("lastAgmDate")
        bsm=months_between(bs,today) if bs else None; am=months_between(agm,today) if agm else None
        if (bsm and bsm>36) or (am and am>36): F.append(("MCA-02","G-FILING","CORPORATE",12,False,"Filings badly overdue"))
        elif (bsm and bsm>24) or (am and am>18): F.append(("MCA-02","G-FILING","CORPORATE",8,False,"Filings overdue"))
        if m.get("paidUpCapital") is not None and m["paidUpCapital"]<100000: F.append(("MCA-04","G-CAPITAL","CORPORATE",3,False,"Very low paid-up capital"))
        for d in m.get("directors",[]):
            if d.get("disqualified"): disq.add(d["din"] or d["name"])
    reg=ad.get("regulatory")
    if reg and reg["status"]=="ok":
        for x in reg["matches"]:
            if x["list"]=="MCA_DISQUALIFIED_DIRECTORS" and x["confidence"]>=0.8: disq.add(x["matchedName"])
            elif x["list"]!="MCA_DISQUALIFIED_DIRECTORS" and x["confidence"]>=0.8: F.append(("REG-01","G-REG","ADVERSE",10,False,"Regulatory match"))
    if disq: F.append(("MCA-03","G-DISQ","CORPORATE",12,False,"Disqualified director"))
    l=ad.get("legal")
    if l and l["status"]=="ok":
        for n in l.get("insolvencyNotices",[]):
            if re.search(r"CIRP|insolvency|liquidation|winding",n["noticeType"],re.I) and n.get("matchConfidence",1)>=0.7:
                F.append(("LEG-01","G-INSOLV","LEGAL",25,True,"Insolvency proceedings")); break
        cases=[c for c in l.get("cases",[]) if c["status"]=="Pending" and c.get("matchConfidence",1)>=0.7]
        resp=[c for c in cases if c["role"] in ("Respondent","Defendant","Accused")]
        if any(re.search(r"138|cheque|recovery|DRT|SARFAESI",c["caseType"],re.I) for c in resp): F.append(("LEG-02","G-CASES","LEGAL",12,False,"Pending recovery/cheque case"))
        if len(resp)>=3: F.append(("LEG-03","G-CASES","LEGAL",8,False,"Multiple pending cases"))
        if cases: F.append(("LEG-04","G-CASES","LEGAL",3,False,"Pending case"))
    n=ad.get("news")
    if n and n["status"]=="ok":
        arts=[a for a in n["articles"] if a["entityMatchConfidence"]>=0.7 and months_between(a["publishedDate"],today)<=24]
        if any(a["severity"]=="high" for a in arts): F.append(("NEWS-01","G-NEWS","ADVERSE",12,False,"High-severity adverse news"))
        elif any(a["severity"]=="medium" for a in arts): F.append(("NEWS-02","G-NEWS","ADVERSE",6,False,"Medium-severity adverse news"))
    u=ad.get("udyam")
    if u and u["status"]=="not_found": F.append(("BIZ-01","G-UDYAM","LEGITIMACY",4,False,"Udyam not found"))
    names=[x for x in (g and g.get("legalName"), m and m.get("companyName"), u and u.get("enterpriseName")) if x]
    if len(names)>=2 and min(sim(names[0],x) for x in names[1:])<0.85: F.append(("BIZ-02","G-NAME","LEGITIMACY",5,False,"Name mismatch"))
    return F

def score(F, ad, carried=()):
    applied={c:0 for c in CAPS}
    best={}
    for r,gr,c,p,h,t in F:
        k=(c,gr); best[k]=max(best.get(k,0),p)
    for (c,_),p in best.items(): applied[c]+=p
    for c in applied: applied[c]=min(applied[c],CAPS[c])
    s=100-sum(applied.values()); hard=[t for *_,h,t in F if h]
    cov=sum(CAPS[c] for c,a in PRIMARY.items() if (ad.get(a,{}).get("status") in ("ok","not_found")) or a in carried)/100
    grade="D" if hard else "A" if s>=85 else "B" if s>=70 else "C" if s>=50 else "D"
    return s,grade,hard,cov,applied

if __name__=="__main__":
    data=json.load(open("fixtures/demo-companies.json")); today=date.fromisoformat(data["demoToday"])
    ok=True
    for c in data["companies"]:
        merged={}
        for snap in c["snapshots"]:
            carried=[k for k in merged]  # adapters carried from previous snapshot
            merged.update(snap["adapters"])
            carried=[k for k in carried if k not in snap["adapters"]]
            F=evaluate(c["subject"],merged,today); s,gr,hard,cov,ap=score(F,merged)
            exp=c["expected"] if snap["label"]=="t0" else c.get("expectedAfterChange",{})
            print(f'{c["key"]:8} {snap["label"]}: score={s:3} grade={gr} cov={cov:.2f} hard={hard} applied={ap}')
            if "score" in exp and exp["score"]!=s: ok=False; print("   MISMATCH expected",exp)
            if "grade" in exp and exp["grade"]!=gr: ok=False; print("   MISMATCH expected",exp)
    sys.exit(0 if ok else 1)
