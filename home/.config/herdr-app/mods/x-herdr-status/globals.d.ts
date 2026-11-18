// herdr's runtime has btoa, which ES2022's lib leaves out; the Azure PR lookup calls it
declare function btoa(data: string): string;
