import type {Metadata} from 'next';
import {Esp32WebGlLab} from '../../../components/Esp32WebGlLab';

export const metadata:Metadata={
  title:'KINGMAST ESP32 WebGL Digital Twin',
  description:'Interactive WebGL ESP32, Raspberry Pi, SD, GPIO and sensor connection simulator for KINGMAST.',
};

export default function Esp32LabPage(){
  return <Esp32WebGlLab/>;
}
