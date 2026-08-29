import { acceptHMRUpdate, defineStore } from 'pinia';

export interface ErpAcctOption {
  acctCode: string;
  isDefault?: boolean;
}

interface ErpAcctState {
  acctCode: string;
  options: ErpAcctOption[];
}

export const useErpAcctStore = defineStore('mes-erp-acct', {
  actions: {
    setAcctCode(acctCode: string | null | undefined) {
      this.acctCode = normalizeAcctCode(acctCode);
    },
    setOptions(options: ErpAcctOption[]) {
      this.options = (options || [])
        .map((item) => ({
          acctCode: normalizeAcctCode(item.acctCode),
          isDefault: !!item.isDefault,
        }))
        .filter((item, index, list) =>
          item.acctCode &&
          list.findIndex((candidate) => candidate.acctCode === item.acctCode) === index,
        );
      const currentExists = this.options.some(
        (item) => item.acctCode === this.acctCode,
      );
      if (!this.acctCode || !currentExists) {
        const defaultOption =
          this.options.find((item) => item.isDefault) ?? this.options[0];
        this.acctCode = normalizeAcctCode(defaultOption?.acctCode);
      }
    },
  },
  persist: {
    pick: ['acctCode'],
  },
  state: (): ErpAcctState => ({
    acctCode: '',
    options: [],
  }),
});

function normalizeAcctCode(acctCode: null | string | undefined) {
  const value = `${acctCode ?? ''}`.trim();
  return value;
}

const hot = import.meta.hot;
if (hot) {
  hot.accept(acceptHMRUpdate(useErpAcctStore, hot));
}
