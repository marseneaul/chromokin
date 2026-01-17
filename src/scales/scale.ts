export class Scale {
  private _domain: number[];
  private _range: number[];

  constructor(domain: number[], range: number[]) {
    this._domain = domain;
    this._range = range;
  }

  public get domain(): number[] {
    return this._domain;
  }
  public get range(): number[] {
    return this._range;
  }
  public set domain(newDomain: number[]) {
    this._domain = newDomain;
  }
  public set range(newRange: number[]) {
    this._range = newRange;
  }

  scale(value: number): number {
    const domainLength = this._domain[1] - this._domain[0];
    const domainFraction = (value - this._domain[0]) / domainLength;
    const rangeLength = this._range[1] - this._range[0];
    const scaledValue = this._range[0] + domainFraction * rangeLength;
    return scaledValue;
  }

  inverse(scaledValue: number): number {
    const rangeLength = this._range[1] - this._range[0];
    const rangeFraction = (scaledValue - this._range[0]) / rangeLength;
    const domainLength = this._domain[1] - this._domain[0];
    const value = this._domain[0] + rangeFraction * domainLength;
    return value;
  }
}
