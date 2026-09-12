import type {Metadata} from 'next';
import {Esp32HardwareSimulator} from '../../../components/Esp32HardwareSimulator';

export const metadata:Metadata={
  title:'KINGMAST ESP32 Digital Twin',
  description:'Interactive ESP32, Raspberry Pi, SD and sensor connection simulator for KINGMAST.',
};

export default function Esp32LabPage(){
  return <Esp32HardwareSimulator/>;
}
